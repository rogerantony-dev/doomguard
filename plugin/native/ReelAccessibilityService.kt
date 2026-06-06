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

    private var windowManager: WindowManager? = null
    private var pill: TextView? = null
    private var overlayShown = false

    // De-dupe state: a single reel fires many content-change events, so we only
    // count when the visible reel's signature changes (and debounce rapid swipes).
    private var lastSignature: String? = null
    private var lastIncrementAt = 0L

    private val prefs by lazy {
        getSharedPreferences("doomguard_reels", Context.MODE_PRIVATE)
    }

    override fun onServiceConnected() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val pkg = event?.packageName?.toString()
        if (pkg != instagramPackage) {
            // Left Instagram entirely — tear the pill down.
            hideOverlay()
            lastSignature = null
            return
        }

        val root = rootInActiveWindow ?: return

        if (!isReels(root)) {
            hideOverlay()
            return
        }

        showOverlay()

        val signature = reelSignature(root)
        if (signature != null && signature != lastSignature) {
            val now = System.currentTimeMillis()
            if (now - lastIncrementAt > 350L) {
                lastSignature = signature
                lastIncrementAt = now
                increment()
            }
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
        updatePill(next)
    }

    // --- Floating pill overlay -------------------------------------------------

    private fun showOverlay() {
        if (overlayShown) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!Settings.canDrawOverlays(this)) return

        val textView = TextView(this).apply {
            text = pillText(currentCount())
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
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

    private fun hideOverlay() {
        if (!overlayShown) return
        pill?.let { view -> runCatching { windowManager?.removeView(view) } }
        pill = null
        overlayShown = false
    }

    private fun updatePill(count: Int) {
        pill?.text = pillText(count)
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
}
