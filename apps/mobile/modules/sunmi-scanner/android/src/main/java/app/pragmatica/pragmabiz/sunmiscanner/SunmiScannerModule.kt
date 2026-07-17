package app.pragmatica.pragmabiz.sunmiscanner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SunmiScannerModule : Module() {
  companion object {
    private const val TAG = "SunmiScannerModule"
    private const val EVENT_NAME = "onScan"
    private const val SCAN_ACTION = "com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED"
    private const val SCAN_DATA_EXTRA = "data"
    private const val MAX_SCAN_LENGTH = 8192
  }

  private var receiverRegistered = false

  private val scanReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action != SCAN_ACTION) return

      val value = intent.getStringExtra(SCAN_DATA_EXTRA)?.trim().orEmpty()
      if (value.isEmpty() || value.length > MAX_SCAN_LENGTH) return

      sendEvent(EVENT_NAME, mapOf("value" to value))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SunmiScanner")

    Events(EVENT_NAME)

    OnStartObserving(EVENT_NAME) {
      registerScanReceiver()
    }

    OnStopObserving(EVENT_NAME) {
      unregisterScanReceiver()
    }

    OnDestroy {
      unregisterScanReceiver()
    }
  }

  private fun registerScanReceiver() {
    if (receiverRegistered) return

    val context = appContext.reactContext?.applicationContext ?: return
    val filter = IntentFilter(SCAN_ACTION)

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(scanReceiver, filter, Context.RECEIVER_EXPORTED)
      } else {
        @Suppress("DEPRECATION")
        context.registerReceiver(scanReceiver, filter)
      }
      receiverRegistered = true
    } catch (error: RuntimeException) {
      Log.w(TAG, "Unable to register the SUNMI scanner receiver", error)
    }
  }

  private fun unregisterScanReceiver() {
    if (!receiverRegistered) return

    val context = appContext.reactContext?.applicationContext
    try {
      context?.unregisterReceiver(scanReceiver)
    } catch (error: IllegalArgumentException) {
      Log.w(TAG, "SUNMI scanner receiver was already unregistered", error)
    } finally {
      receiverRegistered = false
    }
  }
}
