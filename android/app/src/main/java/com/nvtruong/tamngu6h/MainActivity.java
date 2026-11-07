package com.nvtruong.tamngu6h;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TamNguWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
