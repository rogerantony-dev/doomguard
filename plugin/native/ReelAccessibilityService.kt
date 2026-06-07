package com.rogerantony.doomguard

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
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
 * read the accessibility node tree. The two heuristics most likely to need
 * tuning against a specific Instagram version are [isReels] and [reelSignature];
 * they are isolated and commented for that reason.
 */
class ReelAccessibilityService : AccessibilityService() {

    private val instagramPackage = "com.instagram.android"

    // When true the pill always shows while Instagram is foreground and prints
    // what the detector sees (in-reels flag, sampled view-ids, signature). Flip
    // to true only for a tuning build — it's noisy and not for real use.
    private val debug = false

    private var windowManager: WindowManager? = null
    private var pill: TextView? = null
    private var overlayShown = false

    // De-dupe state. Primary signal is the reels pager's scroll position, which
    // changes the instant you swipe (no waiting for labels to load). The author
    // "signature" is a fallback for devices/versions that don't report indices.
    private var lastPosition = -1
    private var lastSignature: String? = null
    private var lastIncrementAt = 0L
    // Latches once we successfully read a scroll position, so the slower
    // signature fallback stops firing and can't double-count.
    private var positionModeActive = false

    private val prefs by lazy {
        getSharedPreferences("doomguard_reels", Context.MODE_PRIVATE)
    }

    override fun onServiceConnected() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val pkg = event.packageName?.toString()
        if (pkg != instagramPackage) {
            // Left Instagram entirely — tear the pill down and reset position.
            hideOverlay()
            lastPosition = -1
            lastSignature = null
            return
        }

        val root = rootInActiveWindow ?: return
        val inReels = isReels(root)

        // Primary trigger: the pager scroll index, available right on the swipe.
        val position = scrollPosition(event)
        if (inReels && position != null) {
            positionModeActive = true
            if (position != lastPosition) {
                lastPosition = position
                maybeIncrement()
            }
        }

        // Fallback trigger: author signature, only if indices never arrive.
        // Computed lazily — once position-mode is active we skip the tree-walk.
        val signature =
            if (debug || (inReels && !positionModeActive)) reelSignature(root) else null
        if (inReels && !positionModeActive && signature != null && signature != lastSignature) {
            lastSignature = signature
            maybeIncrement()
        }

        if (debug) {
            // Always visible on Instagram so we can read what the detector sees.
            render(debugText(root, inReels, position, signature))
        } else if (inReels) {
            render(pillText(currentCount()))
        } else {
            hideOverlay()
        }
    }

    /** Increment at most once per ~300ms so a single fling counts once. */
    private fun maybeIncrement() {
        val now = System.currentTimeMillis()
        if (now - lastIncrementAt > 300L) {
            lastIncrementAt = now
            increment()
        }
    }

    /** Adapter position of the reel currently snapped into view, if reported. */
    private fun scrollPosition(event: AccessibilityEvent): Int? {
        if (event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) return null
        if (event.fromIndex >= 0) return event.fromIndex
        if (event.toIndex >= 0) return event.toIndex
        return null
    }

    private fun debugText(
        root: AccessibilityNodeInfo,
        inReels: Boolean,
        position: Int?,
        signature: String?,
    ): String {
        val ids = collectViewIdFragments(root, 6).joinToString(", ")
        return buildString {
            append("reels=").append(inReels).append("  n=").append(currentCount()).append('\n')
            append("pos=").append(position?.toString() ?: "—")
            append("  posMode=").append(positionModeActive).append('\n')
            append("sig=").append(signature ?: "—").append('\n')
            append("ids=").append(if (ids.isBlank()) "—" else ids)
        }
    }

    override fun onInterrupt() {}

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        hideOverlay()
        return super.onUnbind(intent)
    }

    // --- Detection heuristics (tuning lives here) ------------------------------

    /** True when the Reels viewer is the thing currently on screen. */
    private fun isReels(root: AccessibilityNodeInfo): Boolean {
        // Preferred signal: IG's reels view-pager id. Often obfuscated in release
        // builds, so we also fall back to content-description fingerprints.
        if (findByIdFragment(root, "clips_viewer") != null) return true
        if (findByIdFragment(root, "reel_viewer") != null) return true

        val descriptions = collectContentDescriptions(root, 80)
            .joinToString(" ") { it.lowercase(Locale.US) }
        if (descriptions.contains("reel by ")) return true
        // The reel action rail: like + comment + share/remix shown together.
        return descriptions.contains("like") &&
            descriptions.contains("comment") &&
            (descriptions.contains("remix") || descriptions.contains("share"))
    }

    /**
     * A stable-ish identifier for the reel currently in view, so that swiping to
     * the next reel registers as exactly one new view. Prefers the author label.
     */
    private fun reelSignature(root: AccessibilityNodeInfo): String? {
        val descriptions = collectContentDescriptions(root, 160)
        descriptions.firstOrNull { it.contains("Reel by", ignoreCase = true) }?.let { return it }
        return descriptions.firstOrNull {
            it.contains("Original audio", ignoreCase = true) || it.contains("· Audio", ignoreCase = true)
        }
    }

    // --- Counting + daily reset ------------------------------------------------

    private fun today(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    private fun currentCount(): Int {
        val storedDate = prefs.getString("date", null)
        val today = today()
        if (storedDate != today) {
            prefs.edit().putString("date", today).putInt("count", 0).apply()
            return 0
        }
        return prefs.getInt("count", 0)
    }

    private fun increment() {
        val next = currentCount() + 1
        prefs.edit().putString("date", today()).putInt("count", next).apply()
    }

    // --- Floating pill overlay -------------------------------------------------

    /** Show the pill (creating it on first call) and set its text. */
    private fun render(text: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!Settings.canDrawOverlays(this)) return

        if (!overlayShown) {
            val textView = TextView(this).apply {
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, if (debug) 11f else 14f)
                setPadding(dp(16), dp(8), dp(16), dp(8))
                background = pillBackground()
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
                y = dp(56)
            }
            runCatching {
                windowManager?.addView(textView, params)
                pill = textView
                overlayShown = true
            }
        }
        pill?.text = text
    }

    private fun hideOverlay() {
        if (!overlayShown) return
        pill?.let { view -> runCatching { windowManager?.removeView(view) } }
        pill = null
        overlayShown = false
    }

    private fun pillText(count: Int): String = "🎬  $count reels today"

    private fun pillBackground(): GradientDrawable =
        GradientDrawable().apply {
            cornerRadius = dp(22).toFloat()
            setColor(Color.parseColor("#E6101012"))
            setStroke(dp(1), Color.parseColor("#33FFFFFF"))
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    // --- Node-tree traversal helpers ------------------------------------------

    private fun collectContentDescriptions(
        root: AccessibilityNodeInfo,
        limit: Int,
    ): List<String> {
        val results = ArrayList<String>()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 2500 && results.size < limit) {
            val node = queue.removeFirst()
            visited++
            node.contentDescription?.toString()?.let { if (it.isNotBlank()) results.add(it) }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { queue.add(it) }
            }
        }
        return results
    }

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
