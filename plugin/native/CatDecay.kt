package com.rogerantony.wilt

import android.graphics.Color

/**
 * The cat that rots. One drawing of the mascot, decaying with the minutes
 * spent against the daily limit: fresh, wilting, mouldy, rotting, nearly gone,
 * and a skull once the limit is blown. Six frames, drawn from
 * design-previews/rot-cat.js and rendered to res/drawable/wilt_catface_1..6.
 *
 * The pill and the home-screen widget both read from here so they can never
 * disagree about what the cat looks like. Bands are fractions of the limit;
 * the last one is reached at the limit itself, not a minute over, because the
 * moment you hit it is the moment the cat is gone.
 */
object CatDecay {

    /** Six stages, 1 = fresh .. 6 = gone. */
    fun stage(usedMinutes: Int, limitMinutes: Int): Int {
        if (limitMinutes <= 0) return 1
        if (usedMinutes >= limitMinutes) return 6
        val frac = usedMinutes.toDouble() / limitMinutes
        return when {
            frac >= 0.92 -> 5
            frac >= 0.82 -> 4
            frac >= 0.65 -> 3
            frac >= 0.35 -> 2
            else -> 1
        }
    }

    fun drawable(usedMinutes: Int, limitMinutes: Int): Int =
        drawableForStage(stage(usedMinutes, limitMinutes))

    fun drawableForStage(stage: Int): Int = when (stage) {
        6 -> R.drawable.wilt_catface_6
        5 -> R.drawable.wilt_catface_5
        4 -> R.drawable.wilt_catface_4
        3 -> R.drawable.wilt_catface_3
        2 -> R.drawable.wilt_catface_2
        else -> R.drawable.wilt_catface_1
    }

    /**
     * Text colour that follows the cat: bone while it is merely wilting, amber
     * once the mould shows, red once it is gone.
     */
    fun textColor(usedMinutes: Int, limitMinutes: Int): Int = when (stage(usedMinutes, limitMinutes)) {
        6 -> Color.parseColor("#D2542F")
        3, 4, 5 -> Color.parseColor("#E0913C")
        else -> Color.parseColor("#F2F1EC")
    }
}
