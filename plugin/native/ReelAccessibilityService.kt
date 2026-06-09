package com.rogerantony.doomguard

import android.accessibilityservice.AccessibilityService
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
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
    private var pill: View? = null
    private var eyeView: EyeView? = null
    private var pillLabel: TextView? = null
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

    // Hide hysteresis: a single mis-detected event shouldn't blink the pill out.
    private val mainHandler = Handler(Looper.getMainLooper())
    private val hideRunnable = Runnable { hideOverlay() }
    private val hideDelayMs = 900L

    override fun onServiceConnected() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        // Heartbeat so the app can confirm the service is actually running.
        prefs.edit().putLong("lastConnectedAt", System.currentTimeMillis()).apply()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val pkg = event.packageName?.toString()
        if (pkg != instagramPackage) {
            // Left Instagram entirely — tear the pill down immediately and reset.
            mainHandler.removeCallbacks(hideRunnable)
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
            mainHandler.removeCallbacks(hideRunnable)
            render(currentCount(), debugText(root, inReels, position, signature))
            return
        }

        if (inReels) {
            // On a reel: keep the pill up and cancel any pending hide so a
            // single mis-detected frame can't blink it out.
            mainHandler.removeCallbacks(hideRunnable)
            render(currentCount())
        } else if (overlayShown) {
            // Possibly left reels — wait out a grace period before hiding, in
            // case this was just a transient detection gap during playback.
            mainHandler.removeCallbacks(hideRunnable)
            mainHandler.postDelayed(hideRunnable, hideDelayMs)
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
        mainHandler.removeCallbacks(hideRunnable)
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

    /**
     * Show the pill (building it on first call) and update it for [count].
     * The eye reddens with the count; [debugText] overrides the label when set.
     */
    private fun render(count: Int, debugText: String? = null) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!Settings.canDrawOverlays(this)) return

        if (!overlayShown) buildPill()
        eyeView?.setIntensity(rednessFor(count))
        pillLabel?.text = debugText ?: pillText(count)
    }

    private fun buildPill() {
        val eye = EyeView(this)
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
                eye,
                LinearLayout.LayoutParams(dp(38), dp(26)).apply { rightMargin = dp(11) }
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
            eyeView = eye
            pillLabel = label
            overlayShown = true
        }
    }

    private fun hideOverlay() {
        if (!overlayShown) return
        pill?.let { view -> runCatching { windowManager?.removeView(view) } }
        pill = null
        eyeView = null
        pillLabel = null
        overlayShown = false
    }

    private fun pillText(count: Int): String =
        if (count == 1) "1 reel today" else "$count reels today"

    /** 0 below 50 reels, ramping to fully bloodshot (1f) by ~200. */
    private fun rednessFor(count: Int): Float =
        ((count - 50f) / 150f).coerceIn(0f, 1f)

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

/**
 * A small, hand-drawn eye that grows bloodshot as [intensity] rises from 0
 * (calm, healthy) to 1 (fully red, veiny). It idly blinks and, once red, emits
 * a soft pulsing glow — giving the pill a bit of life.
 */
private class EyeView(context: Context) : View(context) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    private var intensity = 0f // 0..1 redness
    private var pulse = 0f // 0..1 glow breathing
    private var openness = 1f // 1 open .. ~0 mid-blink

    private var pulseAnimator: ValueAnimator? = null
    private var blinkAnimator: ValueAnimator? = null

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
        scheduleBlink()
    }

    override fun onDetachedFromWindow() {
        pulseAnimator?.cancel()
        blinkAnimator?.cancel()
        removeCallbacks(blinkRunnable)
        super.onDetachedFromWindow()
    }

    private val blinkRunnable = Runnable { blinkOnce() }

    private fun scheduleBlink() {
        // A touch more frequent (twitchy) as the eye gets more strained.
        val delay = (4200L - 1800L * intensity).toLong()
        postDelayed(blinkRunnable, delay)
    }

    private fun blinkOnce() {
        blinkAnimator?.cancel()
        blinkAnimator = ValueAnimator.ofFloat(1f, 0.08f, 1f).apply {
            duration = 220L
            addUpdateListener {
                openness = it.animatedValue as Float
                invalidate()
            }
            start()
        }
        scheduleBlink()
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2f
        val cy = h / 2f
        val eyeW = w * 0.94f
        val eyeH = h * 0.66f * openness

        // Pulsing red glow behind the eye when bloodshot.
        if (intensity > 0f) {
            val glowAlpha = (intensity * (0.30f + 0.30f * pulse) * 255f).toInt().coerceIn(0, 255)
            paint.shader = RadialGradient(
                cx, cy, w * 0.62f,
                Color.argb(glowAlpha, 255, 45, 32), Color.TRANSPARENT,
                Shader.TileMode.CLAMP
            )
            paint.style = Paint.Style.FILL
            canvas.drawCircle(cx, cy, w * 0.62f, paint)
            paint.shader = null
        }

        // Sclera (white of the eye), tinting pink->red with intensity.
        val sclera = lerpColor(Color.WHITE, Color.rgb(255, 214, 208), intensity)
        paint.style = Paint.Style.FILL
        paint.color = sclera
        canvas.drawOval(cx - eyeW / 2f, cy - eyeH / 2f, cx + eyeW / 2f, cy + eyeH / 2f, paint)

        // Bloodshot veins fade in as intensity climbs.
        if (intensity > 0.02f && openness > 0.4f) {
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = (eyeH * 0.045f).coerceAtLeast(1.5f)
            paint.color = Color.argb((intensity * 210f).toInt().coerceIn(0, 255), 214, 28, 22)
            val lx = cx - eyeW * 0.46f
            val rx = cx + eyeW * 0.46f
            canvas.drawLine(lx, cy - eyeH * 0.08f, cx - eyeH * 0.55f, cy + eyeH * 0.10f, paint)
            canvas.drawLine(lx, cy + eyeH * 0.12f, cx - eyeH * 0.50f, cy - eyeH * 0.04f, paint)
            canvas.drawLine(rx, cy - eyeH * 0.12f, cx + eyeH * 0.55f, cy + eyeH * 0.08f, paint)
            canvas.drawLine(rx, cy + eyeH * 0.10f, cx + eyeH * 0.50f, cy - eyeH * 0.06f, paint)
            paint.style = Paint.Style.FILL
        }

        // Iris + pupil + highlight, hidden when the eye is mid-blink.
        if (openness > 0.35f) {
            val irisR = (eyeH * 0.46f)
            val iris = lerpColor(Color.rgb(86, 116, 134), Color.rgb(158, 22, 16), intensity)
            paint.color = iris
            canvas.drawCircle(cx, cy, irisR, paint)
            paint.color = Color.rgb(14, 14, 18)
            canvas.drawCircle(cx, cy, irisR * 0.52f, paint)
            paint.color = Color.argb(225, 255, 255, 255)
            canvas.drawCircle(cx - irisR * 0.30f, cy - irisR * 0.30f, irisR * 0.18f, paint)
        }
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
