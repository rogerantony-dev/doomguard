package expo.modules.doomguardnative

import android.content.Context
import android.provider.Settings
import android.text.TextUtils
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

/**
 * Reports the live state of the two permissions the Reel counter needs, plus
 * today's count, so the JS onboarding UI can show a tick once each is on and
 * actually working. Reads the same SharedPreferences the accessibility service
 * writes (same app process), and Android's settings for permission state.
 */
class DoomguardnativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Doomguard")

    Function("getStatus") {
      val context = appContext.reactContext?.applicationContext
        ?: return@Function defaultStatus()

      mapOf(
        "overlay" to Settings.canDrawOverlays(context),
        "accessibilityEnabled" to isAccessibilityEnabled(context),
        "accessibilityRunning" to isAccessibilityRunning(context),
        "todayCount" to todayCount(context),
        "todayShorts" to todayShorts(context),
        "todaySeconds" to todaySeconds(context),
        "mode" to currentMode(context),
        "limitMinutes" to limitMinutes(context),
      )
    }

    Function("setMode") { mode: String ->
      val context = appContext.reactContext?.applicationContext ?: return@Function
      val normalized = if (mode == "block") "block" else "guilt"
      prefs(context).edit().putString("mode", normalized).apply()
    }

    Function("setLimit") { minutes: Int ->
      val context = appContext.reactContext?.applicationContext ?: return@Function
      prefs(context).edit().putInt("limitMinutes", minutes.coerceIn(5, 240)).apply()
    }

    Function("getHistory") {
      val context = appContext.reactContext?.applicationContext
        ?: return@Function emptyList<Map<String, Any>>()
      history(context)
    }

    Function("consumeOpenCats") {
      val context = appContext.reactContext?.applicationContext ?: return@Function false
      val p = prefs(context)
      val v = p.getBoolean("openCats", false)
      if (v) p.edit().putBoolean("openCats", false).apply()
      v
    }
  }

  private fun defaultStatus(): Map<String, Any> = mapOf(
    "overlay" to false,
    "accessibilityEnabled" to false,
    "accessibilityRunning" to false,
    "todayCount" to 0,
    "todayShorts" to 0,
    "todaySeconds" to 0,
    "mode" to "guilt",
    "limitMinutes" to 60,
  )

  private fun prefs(context: Context) =
    context.getSharedPreferences("doomguard_reels", Context.MODE_PRIVATE)

  private fun currentMode(context: Context): String =
    prefs(context).getString("mode", "guilt") ?: "guilt"

  /** User-set daily limit, in minutes (default 60). */
  private fun limitMinutes(context: Context): Int =
    prefs(context).getInt("limitMinutes", 60).coerceIn(5, 240)

  private fun serviceId(context: Context): String {
    val pkg = context.packageName
    return "$pkg/$pkg.ReelAccessibilityService"
  }

  private fun isAccessibilityEnabled(context: Context): Boolean {
    val enabled = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
    ) ?: return false
    val target = serviceId(context)
    val splitter = TextUtils.SimpleStringSplitter(':')
    splitter.setString(enabled)
    while (splitter.hasNext()) {
      if (splitter.next().equals(target, ignoreCase = true)) return true
    }
    return false
  }

  /** Enabled AND the service has actually connected at least once. */
  private fun isAccessibilityRunning(context: Context): Boolean {
    if (!isAccessibilityEnabled(context)) return false
    val prefs = context.getSharedPreferences("doomguard_reels", Context.MODE_PRIVATE)
    return prefs.getLong("lastConnectedAt", 0L) > 0L
  }

  private fun todayCount(context: Context): Int {
    val prefs = context.getSharedPreferences("doomguard_reels", Context.MODE_PRIVATE)
    return prefs.getInt("count", 0)
  }

  private fun todayShorts(context: Context): Int {
    val prefs = context.getSharedPreferences("doomguard_reels", Context.MODE_PRIVATE)
    return prefs.getInt("shortsCount", 0)
  }

  /** Seconds spent on short-form players (reels + shorts) today; drives the timer. */
  private fun todaySeconds(context: Context): Int {
    val prefs = context.getSharedPreferences("doomguard_reels", Context.MODE_PRIVATE)
    return prefs.getInt("seconds", 0)
  }

  /**
   * Archived days merged with the in-progress (or stale, not-yet-rolled) live
   * day. The live counters are filed under their own stored date, so a
   * yesterday-counter read on a new day is attributed to yesterday, never
   * mislabeled "today".
   */
  private fun history(context: Context): List<Map<String, Any>> {
    val prefs = prefs(context)
    val byDate = linkedMapOf<String, IntArray>() // date -> [seconds, count, shorts]

    runCatching {
      val json = JSONObject(prefs.getString("history", "{}") ?: "{}")
      val keys = json.keys()
      while (keys.hasNext()) {
        val date = keys.next()
        val day = json.getJSONObject(date)
        byDate[date] = intArrayOf(
          day.optInt("seconds"),
          day.optInt("count"),
          day.optInt("shorts"),
        )
      }
    }

    val liveDate = prefs.getString("date", null)
    if (liveDate != null) {
      val cur = byDate[liveDate] ?: intArrayOf(0, 0, 0)
      cur[0] += prefs.getInt("seconds", 0)
      cur[1] += prefs.getInt("count", 0)
      cur[2] += prefs.getInt("shortsCount", 0)
      byDate[liveDate] = cur
    }

    return byDate.entries
      .sortedBy { it.key }
      .map { (date, v) ->
        mapOf(
          "date" to date,
          "seconds" to v[0],
          "count" to v[1],
          "shorts" to v[2],
        )
      }
  }
}
