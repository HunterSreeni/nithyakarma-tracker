package org.nithyakarma.app;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;

// AI-DEV NOTE: Google Play Install Referrer for marketing attribution (funnel plan
// Phase 0a). Returns the raw `referrer` string Play recorded for this install (the
// Play link on nithyakarma.org carries utm_* in it). JS (utils/installReferrer.js)
// stores the first answer and never asks again. Any non-OK response rejects so JS
// can retry on a later launch.
@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

    @PluginMethod
    public void getReferrer(PluginCall call) {
        final InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        final AtomicBoolean settled = new AtomicBoolean(false);
        try {
            client.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int responseCode) {
                    if (!settled.compareAndSet(false, true)) return;
                    try {
                        if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                            ReferrerDetails details = client.getInstallReferrer();
                            JSObject result = new JSObject();
                            result.put("referrer", details.getInstallReferrer());
                            result.put("installBeginSeconds", details.getInstallBeginTimestampSeconds());
                            call.resolve(result);
                        } else {
                            call.reject("Install referrer unavailable", String.valueOf(responseCode));
                        }
                    } catch (Exception e) {
                        call.reject("Install referrer failed", e);
                    } finally {
                        client.endConnection();
                    }
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    if (settled.compareAndSet(false, true)) {
                        client.endConnection();
                        call.reject("Install referrer service disconnected");
                    }
                }
            });
        } catch (Exception e) {
            if (settled.compareAndSet(false, true)) call.reject("Install referrer failed to start", e);
        }
    }
}
