package com.rogerantony.doomguard

import android.accessibilityservice.AccessibilityService
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewOutlineProvider
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Watches the Instagram app and counts how many Reels the user scrolls through
 * each day, drawing a small floating "pill" with the running total on top of
 * the Reels feed. The count resets automatically when the calendar day changes.
 *
 * Detection here is heuristic — there is no DOM/public API for IG's UI, so we
 * read the accessibility node tree. All reel-related actions route through one
 * detector, [detectReel], which both decides "is this a full-screen reel" and
 * extracts the per-reel identity key. The parts most likely to need tuning against
 * a specific Instagram version are [detectReel] (which ids mark the full-screen
 * player) and [coversScreen] (the full-screen bounds thresholds).
 */
class ReelAccessibilityService : AccessibilityService() {

    private val instagramPackage = "com.instagram.android"
    private val youtubePackage = "com.google.android.youtube"

    // When true the pill always shows while Instagram is foreground and prints
    // what the detector sees (in-reels flag, sampled view-ids, signature). Flip
    // to true only for a tuning build — it's noisy and not for real use.
    private val debug = false

    private var windowManager: WindowManager? = null
    private var pill: View? = null
    private var dialView: StopwatchView? = null
    private var pillLabel: TextView? = null
    private var overlayShown = false

    // Block mode: when you're on the Instagram home feed, this cover blanks the whole
    // feed behind a cat photo + a cheeky line and EATS touches over it, so the feed
    // can't be scrolled at all. The bottom nav is left uncovered so you can still
    // leave. Distinct from the pill so the two never fight.
    //
    // Touches are consumed (no FLAG_NOT_TOUCHABLE) which both blocks scrolling and
    // sidesteps Android's 0.8 opacity cap on pass-through overlays; we still stack a
    // few identical layers so it's reliably opaque either way. The layers are built
    // ONCE and kept attached for the service's life; showing/hiding just toggles their
    // window alpha (0 ↔ visible) — no addView/removeView churn, no orphaned windows.
    private val catLayers = mutableListOf<View>()
    private var catImageView: ImageView? = null
    private var catTextView: TextView? = null
    private var catCoverVisible = false
    private val catCoverShown get() = catCoverVisible
    private var blockShowSeq = 0 // rotates the cat/line each time the block re-appears
    private var lastCoverBounds: Rect? = null
    private val catCoverLayerCount = 3

    // A transparent interceptor over the stories tray: the tray stays visible (and its
    // story circles tappable), but it swallows drags so you can't SCROLL the feed from
    // there. A genuine tap is forwarded to the story circle as an accessibility click.
    private var trayCover: View? = null
    private var trayCoverActive = false
    private var trayDownX = 0f
    private var trayDownY = 0f
    private var trayDownAt = 0L

    // The block is shown/hidden on our OWN clock, not IG's sparse accessibility events
    // (which go silent at rest and during tab transitions). The ticker re-scans every
    // ~90ms and hides the block within ~3 ticks of leaving the feed.
    private var coverTickerRunning = false
    private val coverTickMs = 55L
    private val coverTicker = object : Runnable {
        override fun run() {
            if (refreshCover()) mainHandler.postDelayed(this, coverTickMs)
            else coverTickerRunning = false
        }
    }
    private val catCount = 4
    private val coverLines = listOf(
        "Feed's closed.\nHere's a cat.",
        "No scrolling today.\nCat instead.",
        "Nope.\nGo do something else.",
        "This is better for you,\npromise."
    )

    // Per-platform counting de-dup. Each distinct full-screen reel/short is keyed
    // by its on-screen text; keys are compared by word-overlap (not equality) so a
    // caption finishing loading a frame later still reads as the same item and
    // counts once, and a bounded list of keys seen today stops a recount when you
    // scroll back. Reels and shorts keep separate counts; the timer is shared.
    private class Counter(val countPref: String) {
        var lastKey: String? = null
        val recent = ArrayDeque<String>() // newest first, capped at 50
    }
    private val reelCounter = Counter("count")
    private val shortCounter = Counter("shortsCount")
    private var seenKeysDate: String? = null
    // Block mode: throttle the auto-back so one item isn't backed out repeatedly.
    private var lastBackAt = 0L
    // Throttle home-screen widget pushes so the 1s time ticker doesn't spam
    // RemoteViews updates; a changed count still forces an immediate refresh.
    private var lastWidgetUpdateAt = 0L

    // Time-on-reels meter: a 1s ticker accrues real wall-clock seconds while a reel is
    // up, so the pill shows measured minutes. Pauses when the screen is off; stopped by
    // the event handler the moment you leave a reel.
    private var reelTimerRunning = false
    private val reelTimeTicker = object : Runnable {
        override fun run() {
            if (isScreenOn()) addSeconds(1)
            render()
            mainHandler.postDelayed(this, 1000L)
        }
    }

    // Pill upkeep on our OWN clock (same pattern as the cover): once the pill is up, this
    // polls every ~60ms and pulls it the instant you're no longer on a reel — switching
    // tabs or leaving IG/YT — without waiting on IG's events (which go silent at rest).
    private var pillTickerRunning = false
    private val pillTickMs = 60L
    private val pillTicker = object : Runnable {
        override fun run() {
            val keep = runCatching { refreshPill() }.getOrDefault(true)
            if (keep) mainHandler.postDelayed(this, pillTickMs) else pillTickerRunning = false
        }
    }


    private val prefs by lazy {
        getSharedPreferences("doomguard_reels", Context.MODE_PRIVATE)
    }

    // Hide hysteresis: a single mis-detected event shouldn't blink the pill out.
    private val mainHandler = Handler(Looper.getMainLooper())
    // Hides the PILL only. The cat cover has its own ticker-driven lifecycle
    // ([refreshCover]/[hideCatCover]) so the two never fight over the same timer.
    private val hideRunnable = Runnable { hideOverlay() }
    private val hideDelayMs = 250L

    override fun onServiceConnected() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        // Heartbeat so the app can confirm the service is actually running.
        prefs.edit().putLong("lastConnectedAt", System.currentTimeMillis()).apply()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val pkg = event.packageName?.toString()
        if (pkg != instagramPackage && pkg != youtubePackage) {
            // Left a tracked app — tear the pill + cat cover down immediately and reset.
            mainHandler.removeCallbacks(hideRunnable)
            stopReelTimer()
            stopCoverTicker()
            hideOverlay()
            hideCatCover()
            reelCounter.lastKey = null
            shortCounter.lastKey = null
            // Likely heading back to the home screen — make the widget current.
            updateWidget(force = true)
            return
        }

        val root = rootInActiveWindow ?: return

        // Block mode is latency-sensitive — the cat cover has to track the reel and
        // react the instant you change tabs — so it runs ONE fast detection pass per
        // platform (not the broader guilt detectors) and reacts to the event type.
        if (currentMode() == "block" && !debug) {
            stopReelTimer()
            if (pkg == youtubePackage) {
                handleBlockFullScreen(detectShort(root) != null)
            } else {
                handleBlockInstagram()
            }
            return
        }

        // Guilt mode (and the debug overlay): one detection pass per package. Block
        // mode uses STRICT full-screen detection so it never bounces you out of the
        // feed; guilt uses BROADER detection that also counts reels/shorts watched
        // inline in the feed — there we only measure, so anything you watch counts.
        val counter = if (pkg == youtubePackage) shortCounter else reelCounter
        val hit = if (pkg == youtubePackage) detectShortGuilt(root) else detectReelGuilt(root)

        if (debug) {
            mainHandler.removeCallbacks(hideRunnable)
            render(debugText(root, hit))
            return
        }

        // Guilt mode: show + accrue only when actually viewing a reel ON-SCREEN (so the
        // pill doesn't latch onto an off-screen Reels-tab pager neighbour). Counting
        // still keys off the broader detector's identity.
        val onReel = if (pkg == youtubePackage) hit != null else onReelSurface(root)
        if (onReel) {
            if (hit != null) countItem(counter, hit.key)
            startReelTimer()
            render()
            startPillTicker() // owns the pill's hide: pulls it the instant you leave a reel
        }
        // No else: the pill ticker takes it down on its own clock.
    }

    private fun startPillTicker() {
        if (pillTickerRunning) return
        pillTickerRunning = true
        mainHandler.postDelayed(pillTicker, pillTickMs)
    }

    private fun stopPillTicker() {
        pillTickerRunning = false
        mainHandler.removeCallbacks(pillTicker)
    }

    /**
     * Returns true while the pill should stay (still on a reel) so the ticker keeps
     * polling; false once it's pulled (you left the reel / the app), which stops it.
     */
    private fun refreshPill(): Boolean {
        if (currentMode() == "block" || debug) return false
        if (!overlayShown) return false
        val root = rootInActiveWindow ?: return true // transient; keep checking
        val pkg = root.packageName?.toString()
        if (pkg != instagramPackage && pkg != youtubePackage) {
            stopReelTimer(); hideOverlay(); return false // left the app
        }
        val onReel = if (pkg == youtubePackage) detectShortGuilt(root) != null else onReelSurface(root)
        if (onReel) return true
        stopReelTimer(); hideOverlay(); return false // off a reel → gone
    }

    /**
     * Fast, on-screen-scoped "am I actually viewing a reel right now?" — used by the pill
     * ticker (so it can poll quickly) and to gate the pill on/off. Two direct view-id
     * lookups, no tree walk:
     *  - the Reels player (`clips_viewer_view_pager`) ON-SCREEN (covers the window), which
     *    rejects the Reels tab when it's parked off-screen as a bottom-nav pager neighbour
     *    (that off-screen reel is exactly what kept the pill stuck on Profile/Search), or
     *  - a large, on-screen inline feed video.
     */
    private fun onReelSurface(root: AccessibilityNodeInfo): Boolean {
        val win = Rect().also { root.getBoundsInScreen(it) }
        if (win.width() <= 0) return false
        runCatching {
            root.findAccessibilityNodeInfosByViewId("$instagramPackage:id/clips_viewer_view_pager")
        }.getOrNull()?.forEach {
            if (it.isVisibleToUser && coversScreen(root, it)) return true
        }
        runCatching {
            root.findAccessibilityNodeInfosByViewId("$instagramPackage:id/video_container")
        }.getOrNull()?.forEach {
            if (it.isVisibleToUser) {
                val b = Rect().also { r -> it.getBoundsInScreen(r) }
                if (onScreenLargeVideo(b, win)) return true
            }
        }
        return false
    }

    private fun currentMode(): String = prefs.getString("mode", "guilt") ?: "guilt"

    /** Throttled Back-press used to bounce the user out of a full-screen reel/short. */
    private fun backThrottled() {
        val now = System.currentTimeMillis()
        if (now - lastBackAt > 1200L) {
            lastBackAt = now
            performGlobalAction(GLOBAL_ACTION_BACK)
        }
    }

    /**
     * Block mode for a full-screen-only platform (YouTube Shorts): Back-press on
     * sight with a brief "Blocked" pill, else let the overlays fade after a grace.
     */
    private fun handleBlockFullScreen(inReels: Boolean) {
        if (inReels) {
            mainHandler.removeCallbacks(hideRunnable)
            hideCatCover()
            backThrottled()
            renderBlocked()
        } else if (overlayShown || catCoverShown) {
            mainHandler.removeCallbacks(hideRunnable)
            mainHandler.postDelayed(hideRunnable, hideDelayMs)
        }
    }

    /**
     * Block mode for Instagram. An accessibility event just kicks the self-scheduling
     * [coverTicker]; the actual decision lives in [refreshCover] so events and the
     * ticker share one code path. Starting the ticker here means the cover keeps
     * tracking (and hides itself) even after IG stops emitting events.
     */
    private fun handleBlockInstagram() {
        if (refreshCover()) startCoverTicker()
    }

    private fun startCoverTicker() {
        if (coverTickerRunning) return
        coverTickerRunning = true
        mainHandler.postDelayed(coverTicker, coverTickMs)
    }

    private fun stopCoverTicker() {
        coverTickerRunning = false
        mainHandler.removeCallbacks(coverTicker)
    }

    /**
     * One Block-mode decision for the CURRENT Instagram screen. Returns true while the
     * block is up (so the ticker keeps polling), false once we're clear.
     *  - Full-screen Reels player → Back-press (+ "Blocked" pill), stop covering.
     *  - On the home feed → blank the whole feed with the touch-eating cat cover.
     *  - A couple of empty scans in a row → uncover. This is what makes leaving the
     *    feed (or switching tabs) feel instant without flickering on a dropped frame.
     */
    /**
     * Keeps polling (returns true) the whole time Instagram is foreground, so the block
     * shows/hides within one tick (~55ms) of any screen change — including snapping back
     * the instant a story closes onto the feed. Returns false only when we've left IG or
     * block mode, which stops the ticker until the next event restarts it.
     */
    /**
     * Keeps polling (returns true) the whole time Instagram is foreground, so the block
     * shows/hides within one tick (~55ms) of any screen change. The decision is driven
     * by a single fast signal — the bottom-nav HOME TAB being selected — so switching to
     * Reels/Messages/Search/Profile (or opening a story) uncovers INSTANTLY: we don't do
     * any heavy tree work unless we're actually on the feed and about to draw the block.
     */
    private fun refreshCover(): Boolean {
        if (currentMode() != "block") { hideCatCover(); return false }
        val root = rootInActiveWindow ?: return true // transient; keep polling
        if (root.packageName?.toString() != instagramPackage) { hideCatCover(); return false }

        val win = Rect().also { root.getBoundsInScreen(it) }

        // Full-screen Reels player → bounce out (and uncover). One direct lookup.
        if (isFullScreenReel(root, win)) {
            hideCatCover()
            backThrottled()
            renderBlocked()
            mainHandler.removeCallbacks(hideRunnable)
            mainHandler.postDelayed(hideRunnable, hideDelayMs)
            return true
        }

        // On/off signal: the Home tab is selected, OR a real feed post is on screen.
        // Both are needed — the Home tab's `isSelected` flips reliably when you switch
        // tabs, but Instagram often DOESN'T set it on a freshly-opened feed (cold start),
        // where a visible `row_feed_profile_header` is the dependable tell instead. Either
        // way Explore/Reels/Profile/DMs and stories don't expose a visible feed post.
        var feedTabSelected = false
        var navTop = -1
        runCatching {
            root.findAccessibilityNodeInfosByViewId("$instagramPackage:id/feed_tab")
        }.getOrNull()?.forEach { n ->
            if (n.isVisibleToUser) {
                if (n.isSelected) feedTabSelected = true
                val b = Rect().also { n.getBoundsInScreen(it) }
                if (win.height() > 0 && b.top > win.top + win.height() / 2 &&
                    (navTop < 0 || b.top < navTop)
                ) navTop = b.top
            }
        }
        var feedContentTop = -1
        runCatching {
            root.findAccessibilityNodeInfosByViewId("$instagramPackage:id/row_feed_profile_header")
        }.getOrNull()?.forEach { n ->
            if (n.isVisibleToUser) {
                val b = Rect().also { n.getBoundsInScreen(it) }
                if (feedContentTop < 0 || b.top < feedContentTop) feedContentTop = b.top
            }
        }
        if (!feedTabSelected && feedContentTop < 0) { hideCatCover(); hideOverlay(); return true }

        // On the home feed → work out the block bounds (leaving the stories tray) and show.
        val appBarBottom = win.top + dp(85)
        val top = maxOf(appBarBottom, feedContentTop)
        val bottom = if (navTop > win.top + win.height() / 2) navTop else win.bottom - dp(60)
        if (win.width() <= 0 || bottom <= top) { hideCatCover(); return true }

        hideOverlay() // the cover is the feedback here; don't also show the pill
        showBlockCover(Rect(win.left, top, win.right, bottom))
        // Guard the stories-tray strip against scroll while leaving the circles tappable.
        if (feedContentTop > appBarBottom + dp(36)) {
            showTrayCover(Rect(win.left, appBarBottom, win.right, feedContentTop))
        } else {
            hideTrayCover()
        }
        return true
    }

    /** Full-screen Reels player? One direct lookup of the clips pager, must cover the window. */
    private fun isFullScreenReel(root: AccessibilityNodeInfo, win: Rect): Boolean {
        val pagers = runCatching {
            root.findAccessibilityNodeInfosByViewId("$instagramPackage:id/clips_viewer_view_pager")
        }.getOrNull() ?: return false
        for (p in pagers) if (p.isVisibleToUser && coversScreen(root, p)) return true
        return false
    }

    /**
     * Count this item (reel or short, identified by [key]) into [counter] unless
     * we've already counted it today. A null key means labels haven't loaded yet,
     * so we wait for a later event. Keys are matched by word-overlap so a
     * still-loading caption doesn't double-count, and scrolling back doesn't recount.
     */
    private fun countItem(counter: Counter, key: String?) {
        val today = today()
        if (seenKeysDate != today) {
            seenKeysDate = today
            reelCounter.recent.clear(); reelCounter.lastKey = null
            shortCounter.recent.clear(); shortCounter.lastKey = null
        }
        if (key == null) return
        // Same item as the last event (its caption may have just finished loading,
        // growing the key) — adopt the fuller key but don't recount.
        counter.lastKey?.let { if (overlap(key, it) >= 0.9f) { counter.lastKey = key; return } }
        counter.lastKey = key
        // Scrolled back to an item already counted today.
        if (counter.recent.any { overlap(key, it) >= 0.9f }) return
        counter.recent.addFirst(key)
        while (counter.recent.size > 50) counter.recent.removeLast()
        incrementPref(counter.countPref)
    }

    /** Fraction of the smaller key's words shared with the other (0f..1f). */
    private fun overlap(a: String, b: String): Float {
        val wa = a.lowercase(Locale.US).split(' ', '|').filterTo(HashSet()) { it.isNotBlank() }
        val wb = b.lowercase(Locale.US).split(' ', '|').filterTo(HashSet()) { it.isNotBlank() }
        if (wa.isEmpty() || wb.isEmpty()) return if (a == b) 1f else 0f
        val shared = wa.count { it in wb }
        return shared.toFloat() / minOf(wa.size, wb.size)
    }

    private fun nodeText(node: AccessibilityNodeInfo): String? =
        node.text?.toString()?.takeIf { it.isNotBlank() }
            ?: node.contentDescription?.toString()?.takeIf { it.isNotBlank() }

    private fun debugText(root: AccessibilityNodeInfo, hit: Detected?): String {
        val ids = collectViewIdFragments(root, 6).joinToString(", ")
        return buildString {
            append("hit=").append(hit != null).append("  n=").append(currentCount()).append('\n')
            append("key=").append(hit?.key ?: "—").append('\n')
            append("ids=").append(if (ids.isBlank()) "—" else ids)
        }
    }

    override fun onInterrupt() {}

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        mainHandler.removeCallbacks(hideRunnable)
        stopCoverTicker()
        hideOverlay()
        removeCatCover()
        return super.onUnbind(intent)
    }

    // --- Detection heuristics (tuning lives here) ------------------------------

    /** A confirmed full-screen reel/short and its identity [key] (null until loaded). */
    private class Detected(val key: String?)

    /**
     * THE single source of truth for "are we on a full-screen Reel, and which one".
     * Every reel-related action — block-mode Back, guilt counting, the time meter —
     * consumes this one result, so they can never disagree on what a reel is.
     * Returns null unless the dedicated full-screen player actually fills the window.
     *
     * Anchor on ids that exist ONLY in the dedicated full-screen Reels player
     * (Instagram's ClipsViewerFragment), verified against a real device tree and
     * corroborated by every mature open-source IG reel-blocker (curbox, etc.):
     *
     *   - clips_viewer_view_pager: the vertical full-screen ReboundViewPager
     *     holding the swipeable reels. The home feed, Explore, and profile Reels
     *     grids are RecyclerViews and never have it; DM reel-preview bubbles don't.
     *   - clips_ufi_component / clips_author_username / clips_captions_component:
     *     per-reel chrome, present only once a reel has actually rendered. Requiring
     *     at least one rejects the transient/empty clips container, while OR-ing
     *     them survives IG's chrome-stripped fullscreen variants. The author +
     *     caption text double as the per-reel identity [key].
     *
     * We deliberately do NOT match the bottom-nav Reels tab (clips_tab, on every
     * screen), "Reel by" text (feed + DM-shared reels carry it too), nor the story
     * player (reel_viewer_root) — all historical false positives.
     *
     * The id pair alone is NOT enough: IG keeps recycled/off-screen pager nodes in
     * the tree during transitions, and embedded reels surface partial nodes. So we
     * additionally require the pager to be visible AND to physically fill the window
     * (coversScreen) — this is what stops Block mode from pressing Back on DM
     * bubbles, feed items, and the reel sliding away mid-transition.
     */
    private fun detectReel(root: AccessibilityNodeInfo): Detected? {
        var pager: AccessibilityNodeInfo? = null
        var hasReelChrome = false
        var author: String? = null
        var caption: String? = null
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 3000) {
            val node = queue.removeFirst()
            visited++
            node.viewIdResourceName?.let { id ->
                when {
                    // Stories - never the Reels player. Bail the whole detection.
                    id.endsWith("reel_viewer_root") -> return null
                    id.endsWith("clips_viewer_view_pager") ->
                        if (pager == null && node.isVisibleToUser) pager = node
                    id.endsWith("clips_ufi_component") ->
                        if (node.isVisibleToUser) hasReelChrome = true
                    id.endsWith("clips_author_username") -> {
                        hasReelChrome = true
                        if (author == null) author = nodeText(node)
                    }
                    id.endsWith("clips_captions_component") -> {
                        hasReelChrome = true
                        if (caption == null) caption = nodeText(node)
                    }
                }
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        val visiblePager = pager ?: return null
        if (!hasReelChrome) return null
        if (!coversScreen(root, visiblePager)) return null
        // Identity: author + caption prefix (taken before IG's "… more" truncation
        // so an expanding caption doesn't read as a different reel). Null until loaded.
        val key = buildString {
            author?.trim()?.let { append(it) }
            append('|')
            caption?.trim()?.take(48)?.let { append(it) }
        }.trim('|').ifBlank { null }
        return Detected(key)
    }

    /**
     * Guilt-mode reel detection — broader than [detectReel]. Counts two cases the
     * strict full-screen detector misses, because in guilt mode we only measure, so
     * anything you're actually watching should count:
     *
     *   1. The dedicated Reels player, via its `clips_*` chrome (like the strict
     *      detector, but without requiring full-window coverage).
     *   2. A video playing inline in the HOME FEED — delegated to [detectFeedVideo],
     *      which is fenced tightly to the focused feed row (see its doc).
     */
    private fun detectReelGuilt(root: AccessibilityNodeInfo): Detected? {
        var hasReelChrome = false
        var author: String? = null
        var caption: String? = null
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 3000) {
            val node = queue.removeFirst()
            visited++
            node.viewIdResourceName?.let { id ->
                when {
                    id.endsWith("reel_viewer_root") -> return null // stories, not reels
                    id.endsWith("clips_ufi_component") ->
                        if (node.isVisibleToUser) hasReelChrome = true
                    id.endsWith("clips_author_username") ->
                        if (node.isVisibleToUser) {
                            hasReelChrome = true
                            if (author == null) author = nodeText(node)
                        }
                    id.endsWith("clips_captions_component") ->
                        if (node.isVisibleToUser) {
                            hasReelChrome = true
                            if (caption == null) caption = nodeText(node)
                        }
                }
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }

        // Case 1: dedicated Reels player.
        if (hasReelChrome) {
            val key = buildString {
                author?.trim()?.let { append(it) }
                append('|')
                caption?.trim()?.take(48)?.let { append(it) }
            }.trim('|').ifBlank { null }
            return Detected(key)
        }

        // Case 2: inline home-feed video.
        return detectFeedVideo(root)?.let { Detected(it.key) }
    }

    /** An inline home-feed video: its on-screen [bounds] and its identity [key]. */
    private class FeedVideo(val bounds: Rect, val key: String?)

    /**
     * Detect a video playing inline in the Instagram HOME FEED, returning the
     * playing `video_container`'s screen bounds (so Block mode can cover it) and a
     * stable per-post identity key. Shared by guilt counting and block-mode covering.
     *
     * Fenced tightly to the focused feed row so it never reacts to anything else:
     * it fires ONLY when the feed UFI bar (`row_feed_view_group_buttons`, which
     * renders only for the focused feed row) is present AND a `video_container`
     * fills the row's width. That excludes DMs/messages (those are `direct_*` with
     * no `row_feed_*`), Explore and profile reel grids (thumbnails, no large playing
     * video + no feed UFI), the suggested-reels carousel (small previews), and photo
     * posts (no `video_container`). Stories (`reel_viewer_root`) bail out.
     */
    private fun detectFeedVideo(root: AccessibilityNodeInfo): FeedVideo? {
        // "We're in the home-feed timeline" — ANY visible `row_feed_*` node proves it
        // (those ids exist only in feed rows, never DMs/Explore/grids). We use this
        // broad signal rather than the UFI bar specifically, because once a reel fills
        // the viewport its own like/comment bar scrolls off the bottom — the very
        // moment we most need to cover it. The post header usually stays on screen.
        var feedContext = false
        var videoBox: Rect? = null
        var author: String? = null
        var headerDesc: String? = null

        val win = Rect().also { root.getBoundsInScreen(it) }
        if (win.width() <= 0) return null
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 3000) {
            val node = queue.removeFirst()
            visited++
            node.viewIdResourceName?.let { id ->
                when {
                    id.endsWith("reel_viewer_root") -> return null // stories
                    id.contains("row_feed_profile_header") ->
                        if (node.isVisibleToUser) {
                            feedContext = true
                            if (headerDesc == null) headerDesc = node.contentDescription?.toString()
                        }
                    id.contains("row_feed_photo_profile_name") ->
                        if (node.isVisibleToUser) {
                            feedContext = true
                            if (author == null) author = nodeText(node)
                        }
                    id.contains("row_feed") ->
                        if (node.isVisibleToUser) feedContext = true
                    id.endsWith("video_container") ->
                        if (node.isVisibleToUser && videoBox == null) {
                            val box = Rect().also { node.getBoundsInScreen(it) }
                            if (onScreenLargeVideo(box, win)) videoBox = box
                        }
                }
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }

        if (!feedContext) return null
        val box = videoBox ?: return null
        // Identity = the feed header's description with its drifting relative
        // timestamp ("9 hours ago") stripped, falling back to the author handle.
        val key = (headerDesc?.let { stripRelativeTime(it) } ?: author)?.trim()?.ifBlank { null }
        return FeedVideo(box, key)
    }

    /**
     * Is [box] a large video that's actually ON this screen (not an off-screen
     * ViewPager neighbour)? IG keeps the feed tab alive beside Explore/Reels in a
     * horizontal pager, and its `video_container` still reports visible — just parked
     * at x≈-width. We require the box to fill the row's width AND straddle the visible
     * horizontal centre, which rejects those parked neighbours so the cover releases
     * the moment you leave the feed tab.
     */
    private fun onScreenLargeVideo(box: Rect, win: Rect): Boolean {
        if (win.width() <= 0) return false
        if (box.width() < win.width() * 0.90f) return false
        val cx = win.centerX()
        if (box.left > cx || box.right < cx) return false
        return box.bottom > win.top && box.top < win.bottom
    }

    /** Drop a trailing relative timestamp so a post's key doesn't drift as time passes. */
    private fun stripRelativeTime(s: String): String =
        s.replace(
            Regex(
                "\\s*\\d+\\s*(s|m|h|d|w|second|minute|hour|day|week|month|year)s?\\s*ago\\s*$",
                RegexOption.IGNORE_CASE
            ),
            ""
        ).replace(Regex("\\s*(just now|now)\\s*$", RegexOption.IGNORE_CASE), "").trim()

    /**
     * YouTube Shorts analog of [detectReel]. Anchors on `reel_recycler` — the
     * vertical RecyclerView of the full-screen Shorts player, which (unlike IG) is
     * absent from the home Shorts shelf, search, and watch page, so it alone
     * excludes those. We still require it to fill the window (coversScreen) to
     * reject any embedded variant and recycled/off-screen nodes.
     *
     * Identity: YouTube exposes no clean author/title nodes (heavy obfuscation), so
     * we concatenate all text under `reel_player_page_content` and cleanse the fixed
     * chrome strings, then de-dup by the same word-overlap as reels. Verified
     * against curbox + ReVanced, which both anchor on `reel_recycler`.
     */
    private fun detectShort(root: AccessibilityNodeInfo): Detected? {
        var recycler: AccessibilityNodeInfo? = null
        var pageContent: AccessibilityNodeInfo? = null
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 3000) {
            val node = queue.removeFirst()
            visited++
            node.viewIdResourceName?.let { id ->
                when {
                    id.endsWith("reel_recycler") ->
                        if (recycler == null && node.isVisibleToUser) recycler = node
                    id.endsWith("reel_player_page_content") ->
                        if (pageContent == null && node.isVisibleToUser) pageContent = node
                }
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        val player = recycler ?: return null
        if (!coversScreen(root, player)) return null
        return Detected(shortKey(pageContent ?: player))
    }

    /**
     * Guilt-mode shorts detection — broader than [detectShort]. Same `reel_recycler`
     * anchor (which only exists in the full-screen Shorts player, so the home Shorts
     * shelf of thumbnails still won't count), but without the strict full-window
     * coverage gate, so transitions and slightly-inset players still accrue time.
     */
    private fun detectShortGuilt(root: AccessibilityNodeInfo): Detected? {
        var recycler: AccessibilityNodeInfo? = null
        var pageContent: AccessibilityNodeInfo? = null
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 3000) {
            val node = queue.removeFirst()
            visited++
            node.viewIdResourceName?.let { id ->
                when {
                    id.endsWith("reel_recycler") ->
                        if (recycler == null && node.isVisibleToUser) recycler = node
                    id.endsWith("reel_player_page_content") ->
                        if (pageContent == null && node.isVisibleToUser) pageContent = node
                }
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        val player = recycler ?: return null
        return Detected(shortKey(pageContent ?: player))
    }

    /**
     * Per-Short identity: all text + content-descriptions under the page-content
     * node, with YouTube's fixed chrome stripped out. Null until the overlay has
     * loaded enough to be meaningful (or when it's clearly a non-Short layout).
     */
    private fun shortKey(node: AccessibilityNodeInfo): String? {
        val raw = StringBuilder()
        collectText(node, raw, 0)
        val s = raw.toString()
            .replace("Video Progress", "")
            .replace("Tap to watch live", "")
            .replace("Go to channel", "")
            .replace("SearchMoreHomeHomeShortsShortsCreateSubscriptions", "")
            .trim()
        if (s.contains("PostPostPostlike")) return null // not a Short layout
        if (s.length <= 15) return null // not loaded yet — wait for a later event
        return s
    }

    private fun collectText(node: AccessibilityNodeInfo, out: StringBuilder, depth: Int) {
        if (depth > 40) return
        node.text?.let { if (it.isNotBlank()) out.append(it) }
        node.contentDescription?.let { if (it.isNotBlank()) out.append(it) }
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { collectText(it, out, depth + 1) }
        }
    }

    /**
     * The immersive Reels player fills its window; an embedded reel (a home-feed
     * item, a DM preview bubble) or a recycled/transitioning pager node does not.
     * Compare the pager's on-screen box to the active window's box rather than to a
     * fixed pixel size, so the test holds across devices, insets, and split-screen.
     */
    private fun coversScreen(root: AccessibilityNodeInfo, pager: AccessibilityNodeInfo): Boolean {
        val win = Rect().also { root.getBoundsInScreen(it) }
        val box = Rect().also { pager.getBoundsInScreen(it) }
        val w = win.width()
        val h = win.height()
        if (w <= 0 || h <= 0) return false
        // Off-screen / recycled pager parked outside the window.
        if (box.right <= win.left || box.left >= win.right) return false
        return box.width() >= w * 0.90f && box.height() >= h * 0.75f
    }

    // --- Counting + daily reset ------------------------------------------------

    private fun today(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    /** Roll the reel count, the short count, and the shared timer over at midnight. */
    private fun ensureToday() {
        val today = today()
        if (prefs.getString("date", null) != today) {
            prefs.edit()
                .putString("date", today)
                .putInt("count", 0)
                .putInt("shortsCount", 0)
                .putInt("seconds", 0)
                .apply()
        }
    }

    private fun currentCount(): Int {
        ensureToday()
        return prefs.getInt("count", 0)
    }

    private fun incrementPref(name: String) {
        ensureToday()
        prefs.edit().putInt(name, prefs.getInt(name, 0) + 1).apply()
        updateWidget(force = true)
    }

    /** Seconds spent on the full-screen Reels player today. */
    private fun currentSeconds(): Int {
        ensureToday()
        return prefs.getInt("seconds", 0)
    }

    private fun addSeconds(delta: Int) {
        ensureToday()
        prefs.edit().putInt("seconds", prefs.getInt("seconds", 0) + delta).apply()
        updateWidget()
    }

    /**
     * Push the current counts to any placed home-screen widget. Throttled to once
     * per 10s so the per-second time ticker doesn't churn RemoteViews; [force]
     * bypasses the throttle for count changes and when leaving a tracked app.
     */
    private fun updateWidget(force: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && now - lastWidgetUpdateAt < 10_000L) return
        lastWidgetUpdateAt = now
        runCatching { DoomguardWidgetProvider.updateAll(this) }
    }

    // --- Time-on-reels ticker --------------------------------------------------

    private fun startReelTimer() {
        if (reelTimerRunning) return
        reelTimerRunning = true
        mainHandler.postDelayed(reelTimeTicker, 1000L)
    }

    private fun stopReelTimer() {
        if (!reelTimerRunning) return
        reelTimerRunning = false
        mainHandler.removeCallbacks(reelTimeTicker)
    }

    private fun isScreenOn(): Boolean =
        (getSystemService(POWER_SERVICE) as? PowerManager)?.isInteractive ?: true

    // --- Floating pill overlay -------------------------------------------------

    /**
     * Show the pill (building it on first call) and update it for the time spent
     * on reels today. The stopwatch reddens as the minutes climb; [debugText]
     * overrides the label when set.
     */
    private fun render(debugText: String? = null) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!Settings.canDrawOverlays(this)) return

        if (!overlayShown) buildPill()
        dialView?.setIntensity(rednessFor(currentSeconds()))
        pillLabel?.text = debugText ?: pillText(currentSeconds())
    }

    /** Block-mode pill shown the instant we bounce the user out of reels. */
    private fun renderBlocked() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!Settings.canDrawOverlays(this)) return
        if (!overlayShown) buildPill()
        dialView?.setIntensity(1f)
        pillLabel?.text = "🛡  Blocked"
    }

    private fun buildPill() {
        val dial = StopwatchView(this)
        val label = TextView(this).apply {
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, if (debug) 11f else 15f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            letterSpacing = 0.01f
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(10), dp(18), dp(10))
            background = pillBackground()
            elevation = dp(6).toFloat()
            addView(
                dial,
                LinearLayout.LayoutParams(dp(26), dp(26)).apply { rightMargin = dp(11) }
            )
            addView(label)
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = dp(52)
        }

        runCatching {
            windowManager?.addView(container, params)
            pill = container
            dialView = dial
            pillLabel = label
            overlayShown = true
        }
    }

    private fun hideOverlay() {
        if (!overlayShown) return
        stopReelTimer()
        stopPillTicker()
        pill?.let { view -> runCatching { windowManager?.removeView(view) } }
        pill = null
        dialView = null
        pillLabel = null
        overlayShown = false
    }

    // --- Block-mode cat cover (inline feed reels) ------------------------------

    /**
     * Show the full-feed block at [bounds] (the feed area, above the bottom nav). The
     * cat + line rotate each time the block re-appears, then stay put while it's up. We
     * only push a layout when first revealing or when the bounds actually change, so a
     * steady block doesn't churn updateViewLayout every tick.
     */
    private fun showBlockCover(bounds: Rect) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!Settings.canDrawOverlays(this)) return
        if (bounds.width() <= 0 || bounds.height() <= 0) return
        if (catLayers.isEmpty()) buildCatCover()
        if (catLayers.isEmpty()) return

        val fresh = !catCoverVisible
        if (fresh) {
            val idx = blockShowSeq++
            val resId = catDrawableRes((idx % catCount) + 1)
            if (resId != 0) catImageView?.setImageResource(resId)
            catTextView?.text = coverLines[idx % coverLines.size]
        }
        if (fresh || bounds != lastCoverBounds) {
            lastCoverBounds = Rect(bounds)
            for (layer in catLayers) {
                val lp = layer.layoutParams as WindowManager.LayoutParams
                lp.x = bounds.left
                lp.y = bounds.top
                lp.width = bounds.width()
                lp.height = bounds.height()
                lp.alpha = 1f
                runCatching { windowManager?.updateViewLayout(layer, lp) }
            }
        }
        catCoverVisible = true
    }

    private fun buildCatCover() {
        // Bottom-to-top: plain dark layers for occlusion, the cat card only on top.
        for (i in 0 until catCoverLayerCount) {
            val cover = FrameLayout(this).apply {
                setBackgroundColor(Color.parseColor("#050507"))
                isClickable = true // swallow taps/scrolls inside the block
                setOnClickListener { /* eat */ }
            }
            if (i == catCoverLayerCount - 1) {
                val img = ImageView(this).apply {
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    clipToOutline = true
                    outlineProvider = object : ViewOutlineProvider() {
                        override fun getOutline(view: View, outline: Outline) {
                            outline.setRoundRect(0, 0, view.width, view.height, dp(22).toFloat())
                        }
                    }
                }
                val label = TextView(this).apply {
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
                    typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
                    gravity = Gravity.CENTER
                    setLineSpacing(dp(3).toFloat(), 1f)
                }
                val card = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER_HORIZONTAL
                    setPadding(dp(24), dp(24), dp(24), dp(24))
                    addView(img, LinearLayout.LayoutParams(dp(190), dp(190)))
                    addView(
                        label,
                        LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply { topMargin = dp(20) }
                    )
                }
                cover.addView(
                    card,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.CENTER
                    )
                )
                catImageView = img
                catTextView = label
            }

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                // No NOT_TOUCHABLE → the cover CONSUMES touches inside its bounds, so the
                // feed can't be scrolled. NOT_FOCUSABLE keeps it from grabbing the keyboard;
                // NOT_TOUCH_MODAL lets touches OUTSIDE its bounds (the bottom nav) through so
                // you can still leave. LAYOUT_IN_SCREEN/NO_LIMITS → absolute screen coords.
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                alpha = 0f // built hidden; showBlockCover reveals
            }
            runCatching {
                windowManager?.addView(cover, params)
                catLayers.add(cover)
            }
        }
    }

    /** Hide the cover by making the (persistent) layers transparent — no removeView.
     *  Does NOT touch the ticker; its lifecycle is driven by [refreshCover]'s return. */
    private fun hideCatCover() {
        hideTrayCover()
        if (!catCoverVisible) return
        catCoverVisible = false
        lastCoverBounds = null
        for (layer in catLayers) {
            val lp = layer.layoutParams as WindowManager.LayoutParams
            lp.alpha = 0f
            runCatching { windowManager?.updateViewLayout(layer, lp) }
        }
    }

    /** Real teardown of the cover windows — only on service unbind. */
    private fun removeCatCover() {
        for (layer in catLayers) runCatching { windowManager?.removeView(layer) }
        catLayers.clear()
        catImageView = null
        catTextView = null
        catCoverVisible = false
        lastCoverBounds = null
        trayCover?.let { runCatching { windowManager?.removeView(it) } }
        trayCover = null
        trayCoverActive = false
    }

    // --- Stories-tray scroll guard --------------------------------------------

    /**
     * Show/move the transparent interceptor over the stories tray at [band]. It eats
     * drags (so the feed can't be scrolled from the tray) but forwards a genuine tap to
     * the story circle under it via an accessibility click — so stories stay watchable.
     */
    private fun showTrayCover(band: Rect) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!Settings.canDrawOverlays(this)) return
        if (band.width() <= 0 || band.height() <= 0) { hideTrayCover(); return }
        if (trayCover == null) buildTrayCover()
        val view = trayCover ?: return
        val lp = view.layoutParams as WindowManager.LayoutParams
        lp.flags = lp.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv() // make it eat touches
        lp.x = band.left
        lp.y = band.top
        lp.width = band.width()
        lp.height = band.height()
        runCatching { windowManager?.updateViewLayout(view, lp) }
        trayCoverActive = true
    }

    private fun hideTrayCover() {
        if (!trayCoverActive) return
        trayCoverActive = false
        val view = trayCover ?: return
        val lp = view.layoutParams as WindowManager.LayoutParams
        lp.flags = lp.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE // pass through when idle
        runCatching { windowManager?.updateViewLayout(view, lp) }
    }

    private fun buildTrayCover() {
        val view = View(this).apply {
            setOnTouchListener { _, e ->
                when (e.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        trayDownX = e.rawX; trayDownY = e.rawY
                        trayDownAt = System.currentTimeMillis()
                        true
                    }
                    MotionEvent.ACTION_UP -> {
                        val moved = Math.hypot(
                            (e.rawX - trayDownX).toDouble(), (e.rawY - trayDownY).toDouble()
                        )
                        if (moved < dp(16) && System.currentTimeMillis() - trayDownAt < 350L) {
                            clickNodeAt(e.rawX.toInt(), e.rawY.toInt())
                        }
                        true // always consume so a drag never scrolls the feed
                    }
                    else -> true
                }
            }
        }
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE, // built idle
            PixelFormat.TRANSPARENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }
        runCatching {
            windowManager?.addView(view, params)
            trayCover = view
        }
    }

    /** Forward a tap to the clickable node (a story circle) under (x, y). */
    private fun clickNodeAt(x: Int, y: Int) {
        val root = rootInActiveWindow ?: return
        deepestClickableAt(root, x, y)?.let { node ->
            runCatching { node.performAction(AccessibilityNodeInfo.ACTION_CLICK) }
        }
    }

    /** Deepest visible clickable node whose bounds contain (x, y), or null. */
    private fun deepestClickableAt(node: AccessibilityNodeInfo, x: Int, y: Int): AccessibilityNodeInfo? {
        if (!node.isVisibleToUser) return null
        val b = Rect().also { node.getBoundsInScreen(it) }
        if (!b.contains(x, y)) return null
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { deepestClickableAt(it, x, y)?.let { hit -> return hit } }
        }
        return if (node.isClickable) node else null
    }

    /** Resolve a bundled cat drawable (`doomguard_cat_1..N`) by index, 0 if missing. */
    private fun catDrawableRes(index: Int): Int =
        resources.getIdentifier("doomguard_cat_$index", "drawable", packageName)

    private fun pillText(seconds: Int): String {
        val minutes = seconds / 60
        return when {
            minutes < 1 -> "under a min scrolling"
            minutes == 1 -> "1 min scrolling"
            else -> "$minutes min scrolling"
        }
    }

    /** Calm below ~10 min, ramping to fully red (1f) by ~50 min on reels. */
    private fun rednessFor(seconds: Int): Float =
        ((seconds / 60f - 10f) / 40f).coerceIn(0f, 1f)

    private fun pillBackground(): GradientDrawable =
        GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.parseColor("#F21B1B1F"), Color.parseColor("#F20E0E12"))
        ).apply {
            cornerRadius = dp(24).toFloat()
            setStroke(dp(1), Color.parseColor("#26FFFFFF"))
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    // --- Node-tree traversal helpers ------------------------------------------

    private fun findByIdFragment(
        root: AccessibilityNodeInfo,
        fragment: String,
    ): AccessibilityNodeInfo? {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 3000) {
            val node = queue.removeFirst()
            visited++
            node.viewIdResourceName?.let { if (it.contains(fragment, ignoreCase = true)) return node }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        return null
    }

    /** Debug aid: the trailing segment of the first few non-null view ids. */
    private fun collectViewIdFragments(
        root: AccessibilityNodeInfo,
        limit: Int,
    ): List<String> {
        val results = LinkedHashSet<String>()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 3000 && results.size < limit) {
            val node = queue.removeFirst()
            visited++
            node.viewIdResourceName?.substringAfterLast('/')?.let {
                if (it.isNotBlank()) results.add(it)
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        return results.toList()
    }
}

/**
 * A small, hand-drawn stopwatch whose face reddens as [intensity] rises from 0
 * (calm) to 1 (alarming). Its hand sweeps continuously so the pill reads as a
 * running timer, and once red it emits a soft pulsing glow — a visual nag that
 * grows with the minutes spent on reels.
 */
private class StopwatchView(context: Context) : View(context) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    private var intensity = 0f // 0..1 redness
    private var pulse = 0f // 0..1 glow breathing
    private var handAngle = 0f // degrees, 0 = 12 o'clock, sweeping clockwise

    private var pulseAnimator: ValueAnimator? = null
    private var sweepAnimator: ValueAnimator? = null

    fun setIntensity(value: Float) {
        val clamped = value.coerceIn(0f, 1f)
        if (clamped != intensity) {
            intensity = clamped
            invalidate()
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        pulseAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 1500L
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener {
                pulse = it.animatedValue as Float
                if (intensity > 0f) invalidate()
            }
            start()
        }
        sweepAnimator = ValueAnimator.ofFloat(0f, 360f).apply {
            duration = 2000L // one sweep every two seconds
            repeatMode = ValueAnimator.RESTART
            repeatCount = ValueAnimator.INFINITE
            interpolator = android.view.animation.LinearInterpolator()
            addUpdateListener {
                handAngle = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    override fun onDetachedFromWindow() {
        pulseAnimator?.cancel()
        sweepAnimator?.cancel()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2f
        val cy = h / 2f
        val r = minOf(w, h) * 0.36f

        // Pulsing red glow behind the watch when the minutes pile up.
        if (intensity > 0f) {
            val glowAlpha = (intensity * (0.30f + 0.30f * pulse) * 255f).toInt().coerceIn(0, 255)
            paint.shader = RadialGradient(
                cx, cy, r * 1.7f,
                Color.argb(glowAlpha, 255, 45, 32), Color.TRANSPARENT,
                Shader.TileMode.CLAMP
            )
            paint.style = Paint.Style.FILL
            canvas.drawCircle(cx, cy, r * 1.7f, paint)
            paint.shader = null
        }

        val ringColor = lerpColor(Color.rgb(150, 162, 173), Color.rgb(214, 28, 22), intensity)
        val faceColor = lerpColor(Color.rgb(238, 240, 243), Color.rgb(255, 205, 200), intensity)

        // Crown (top button) + two side buttons.
        paint.style = Paint.Style.FILL
        paint.color = ringColor
        val crownW = r * 0.30f
        canvas.drawRoundRect(
            cx - crownW / 2f, cy - r - r * 0.34f, cx + crownW / 2f, cy - r + r * 0.06f,
            crownW * 0.4f, crownW * 0.4f, paint
        )
        paint.strokeWidth = r * 0.16f
        paint.strokeCap = Paint.Cap.ROUND
        paint.style = Paint.Style.STROKE
        canvas.drawLine(cx + r * 0.62f, cy - r * 0.62f, cx + r * 0.82f, cy - r * 0.82f, paint)

        // Face disc + ring.
        paint.style = Paint.Style.FILL
        paint.color = faceColor
        canvas.drawCircle(cx, cy, r, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = r * 0.14f
        paint.color = ringColor
        canvas.drawCircle(cx, cy, r, paint)

        // Quarter tick marks.
        paint.strokeWidth = r * 0.10f
        for (i in 0 until 4) {
            val a = Math.toRadians((i * 90).toDouble())
            val sx = cx + (r * 0.74f) * Math.sin(a).toFloat()
            val sy = cy - (r * 0.74f) * Math.cos(a).toFloat()
            val ex = cx + (r * 0.92f) * Math.sin(a).toFloat()
            val ey = cy - (r * 0.92f) * Math.cos(a).toFloat()
            canvas.drawLine(sx, sy, ex, ey, paint)
        }

        // Sweeping hand (+ short counterweight tail), darkening to red.
        val handColor = lerpColor(Color.rgb(44, 48, 56), Color.rgb(176, 18, 14), intensity)
        val rad = Math.toRadians(handAngle.toDouble())
        val hx = cx + (r * 0.78f) * Math.sin(rad).toFloat()
        val hy = cy - (r * 0.78f) * Math.cos(rad).toFloat()
        val tx = cx - (r * 0.24f) * Math.sin(rad).toFloat()
        val ty = cy + (r * 0.24f) * Math.cos(rad).toFloat()
        paint.color = handColor
        paint.strokeWidth = r * 0.13f
        canvas.drawLine(tx, ty, hx, hy, paint)

        // Center hub.
        paint.style = Paint.Style.FILL
        canvas.drawCircle(cx, cy, r * 0.13f, paint)
    }

    private fun lerpColor(from: Int, to: Int, t: Float): Int {
        val tt = t.coerceIn(0f, 1f)
        return Color.rgb(
            (Color.red(from) + (Color.red(to) - Color.red(from)) * tt).toInt(),
            (Color.green(from) + (Color.green(to) - Color.green(from)) * tt).toInt(),
            (Color.blue(from) + (Color.blue(to) - Color.blue(from)) * tt).toInt()
        )
    }
}
