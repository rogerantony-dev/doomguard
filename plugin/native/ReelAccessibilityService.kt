package com.rogerantony.doomguard

import android.accessibilityservice.AccessibilityService
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
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
    // Block-mode full-screen cover overlay (replaces the old auto-Back press).
    private var blockCover: View? = null
    private var blockCountLabel: TextView? = null
    private var blockCoverShown = false
    // Transient audio focus held while the cover is up, to hush the reel's sound.
    private var hasAudioFocus = false
    private val audioFocusListener = AudioManager.OnAudioFocusChangeListener { }
    // Throttle home-screen widget pushes so the 1s time ticker doesn't spam
    // RemoteViews updates; a changed count still forces an immediate refresh.
    private var lastWidgetUpdateAt = 0L

    // Time-on-reels meter: a 1s ticker accrues real wall-clock seconds while the
    // full-screen player is up, so the pill shows measured minutes (not a guess).
    // Pauses when the screen is off and stops the moment you leave reels.
    private var reelTimerRunning = false
    private val reelTimeTicker = object : Runnable {
        override fun run() {
            if (isScreenOn()) addSeconds(1)
            render()
            mainHandler.postDelayed(this, 1000L)
        }
    }

    private val prefs by lazy {
        getSharedPreferences("doomguard_reels", Context.MODE_PRIVATE)
    }

    private val audioManager by lazy {
        getSystemService(AUDIO_SERVICE) as AudioManager
    }

    // Hide hysteresis: a single mis-detected event shouldn't blink the pill out.
    private val mainHandler = Handler(Looper.getMainLooper())
    private val hideRunnable = Runnable { hideOverlay(); hideBlockCover() }
    private val hideDelayMs = 900L

    override fun onServiceConnected() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        // Heartbeat so the app can confirm the service is actually running.
        prefs.edit().putLong("lastConnectedAt", System.currentTimeMillis()).apply()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val pkg = event.packageName?.toString()
        if (pkg != instagramPackage && pkg != youtubePackage) {
            // Left a tracked app — tear the pill down immediately and reset.
            mainHandler.removeCallbacks(hideRunnable)
            stopReelTimer()
            hideOverlay()
            hideBlockCover()
            reelCounter.lastKey = null
            shortCounter.lastKey = null
            // Likely heading back to the home screen — make the widget current.
            updateWidget(force = true)
            return
        }

        val root = rootInActiveWindow ?: return
        val blocking = currentMode() == "block"
        // One detection pass per package feeds every decision below, so block mode,
        // guilt counting, and the shared time meter can't disagree on what counts.
        // Block mode uses the STRICT full-screen detectors so it never bounces you
        // out of the home feed; Guilt mode uses BROADER ones that also count reels
        // and shorts watched inline in the feed — there we only measure, so anything
        // you're actually watching should count.
        val counter = if (pkg == youtubePackage) shortCounter else reelCounter
        val hit = if (pkg == youtubePackage) {
            if (blocking) detectShort(root) else detectShortGuilt(root)
        } else {
            if (blocking) detectReel(root) else detectReelGuilt(root)
        }

        if (debug) {
            mainHandler.removeCallbacks(hideRunnable)
            render(debugText(root, hit))
            return
        }

        // Block mode: kick the user out of reels/shorts instead of timing them.
        if (blocking) {
            stopReelTimer()
            handleBlockMode(hit != null)
            return
        }

        // Guilt mode: accrue shared time and count per platform.
        if (hit != null) {
            countItem(counter, hit.key)
            startReelTimer()
            // On a reel/short: keep the pill up and cancel any pending hide so a
            // single mis-detected frame can't blink it out.
            mainHandler.removeCallbacks(hideRunnable)
            render()
        } else if (overlayShown) {
            stopReelTimer()
            // Possibly left reels — wait out a grace period before hiding, in
            // case this was just a transient detection gap during playback.
            mainHandler.removeCallbacks(hideRunnable)
            mainHandler.postDelayed(hideRunnable, hideDelayMs)
        }
    }

    private fun currentMode(): String = prefs.getString("mode", "guilt") ?: "guilt"

    /** Block mode: cover the full-screen reel instead of bouncing the user out. */
    private fun handleBlockMode(inReels: Boolean) {
        if (inReels) {
            mainHandler.removeCallbacks(hideRunnable)
            showBlockCover()
        } else if (blockCoverShown) {
            mainHandler.removeCallbacks(hideRunnable)
            mainHandler.postDelayed(hideRunnable, hideDelayMs)
        }
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
        hideOverlay()
        hideBlockCover()
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
     * Guilt-mode reel detection — broader than [detectReel]. Counts a reel
     * whenever its per-reel chrome (the like/comment UFI bar, author, or caption)
     * is actually rendered, WITHOUT requiring the dedicated full-screen player or
     * full-window coverage. That makes inline reels in the home feed count too:
     * in guilt mode we only measure, so if you're watching it, it counts.
     *
     * It reuses the same trusted chrome ids as [detectReel] (which only render for
     * a real, displayed reel card), so grids of reel thumbnails — which show no
     * chrome — still don't trigger it, and stories (`reel_viewer_root`) bail out.
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
        if (!hasReelChrome) return null
        val key = buildString {
            author?.trim()?.let { append(it) }
            append('|')
            caption?.trim()?.take(48)?.let { append(it) }
        }.trim('|').ifBlank { null }
        return Detected(key)
    }

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
                .putInt("blocked", 0)
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

        hideBlockCover() // the guilt pill and the block cover are mutually exclusive
        if (!overlayShown) buildPill()
        dialView?.setIntensity(rednessFor(currentSeconds()))
        pillLabel?.text = debugText ?: pillText(currentSeconds())
    }

    // --- Block-mode full-screen cover ------------------------------------------

    /**
     * Cover the full-screen reel with an opaque "blocked" screen instead of
     * pressing Back. It eats touches on the reel underneath, hushes the audio via
     * transient audio focus, tallies a "dodge", and offers a deliberate "Back to
     * feed" button — far less janky than fighting the OS with repeated back-presses.
     */
    private fun showBlockCover() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!Settings.canDrawOverlays(this)) return
        hideOverlay() // never show the guilt pill and the cover at once
        if (!blockCoverShown) {
            incrementPref("blocked") // one dodge per cover session
            requestAudioSilence()
            buildBlockCover()
        }
        blockCountLabel?.text = blockedCountText()
    }

    private fun buildBlockCover() {
        val emoji = TextView(this).apply {
            text = "🐱"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 64f)
            gravity = Gravity.CENTER
        }
        val title = TextView(this).apply {
            text = "Reel blocked"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 24f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        val sub = TextView(this).apply {
            text = "Take a breath — Block mode caught it."
            setTextColor(Color.parseColor("#9C9CA6"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            gravity = Gravity.CENTER
        }
        val count = TextView(this).apply {
            setTextColor(Color.parseColor("#19E3FF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            gravity = Gravity.CENTER
            text = blockedCountText()
        }
        val button = TextView(this).apply {
            text = "Back to feed"
            setTextColor(Color.parseColor("#04140B"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(dp(44), dp(15), dp(44), dp(15))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#19E3FF"))
            }
            isClickable = true
            setOnClickListener {
                hideBlockCover()
                performGlobalAction(GLOBAL_ACTION_BACK)
            }
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#08080A"))
            setPadding(dp(32), dp(32), dp(32), dp(32))
            addView(emoji)
            addView(title, lpTop(dp(18)))
            addView(sub, lpTop(dp(8)))
            addView(count, lpTop(dp(22)))
            addView(button, lpTop(dp(30)))
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.OPAQUE
        )

        runCatching {
            windowManager?.addView(container, params)
            blockCover = container
            blockCountLabel = count
            blockCoverShown = true
        }
    }

    private fun hideBlockCover() {
        if (!blockCoverShown) return
        abandonAudioSilence()
        blockCover?.let { view -> runCatching { windowManager?.removeView(view) } }
        blockCover = null
        blockCountLabel = null
        blockCoverShown = false
    }

    private fun blockedCountText(): String {
        val n = prefs.getInt("blocked", 0).coerceAtLeast(1)
        return "🛡  $n ${if (n == 1) "reel" else "reels"} dodged today"
    }

    private fun lpTop(margin: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = margin }

    @Suppress("DEPRECATION")
    private fun requestAudioSilence() {
        if (hasAudioFocus) return
        hasAudioFocus = audioManager.requestAudioFocus(
            audioFocusListener,
            AudioManager.STREAM_MUSIC,
            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT,
        ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    @Suppress("DEPRECATION")
    private fun abandonAudioSilence() {
        if (!hasAudioFocus) return
        audioManager.abandonAudioFocus(audioFocusListener)
        hasAudioFocus = false
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
        pill?.let { view -> runCatching { windowManager?.removeView(view) } }
        pill = null
        dialView = null
        pillLabel = null
        overlayShown = false
    }

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
