package com.nhanhvale.write;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.Toast;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class QuickTopicActivity extends Activity {
    static final String QUICK_TOPIC = "com.nhanhvale.write.QUICK_TOPIC";
    private static final String ORIGIN = "https://write.nhanhvale.com/";
    private static final int BASE64_FLAGS = Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING;
    private boolean opening;
    private EditText title;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (QUICK_TOPIC.equals(getIntent().getAction()) && getIntent().getComponent() != null
                && getClass().getName().equals(getIntent().getComponent().getClassName())) {
            showEntry(state);
            return;
        }

        new AlertDialog.Builder(this)
            .setTitle("Write")
            .setMessage("Liên kết một lần bằng Chrome để widget lưu vào dữ liệu Write đang dùng.")
            .setPositiveButton("Liên kết widget", (dialog, which) -> {
                if (openInChrome("write-widget-link=" + getKey())) finish();
                else recreate();
            })
            .setNeutralButton("Mở Write", (dialog, which) -> {
                if (openInChrome("")) finish();
                else recreate();
            })
            .setNegativeButton("Đóng", (dialog, which) -> finish())
            .setOnCancelListener(dialog -> finish())
            .show();
    }

    private void showEntry(Bundle state) {
        title = new EditText(this);
        title.setHint("Tên chủ đề");
        title.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        title.setSingleLine(true);
        title.setImeOptions(EditorInfo.IME_ACTION_DONE);
        title.setFilters(new InputFilter[] {new InputFilter.LengthFilter(240)});
        if (state != null) title.setText(state.getString("title", ""));
        title.setOnEditorActionListener((view, action, event) -> {
            if (event != null && (event.getKeyCode() == KeyEvent.KEYCODE_ENTER
                    || event.getKeyCode() == KeyEvent.KEYCODE_NUMPAD_ENTER)) {
                if (event.getAction() == KeyEvent.ACTION_UP && !event.isCanceled()) submit();
                return true;
            }
            if (action != EditorInfo.IME_ACTION_DONE) return false;
            submit();
            return true;
        });

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Thêm nhanh chủ đề")
            .setView(title)
            .setNegativeButton("Hủy", (view, which) -> finish())
            .setPositiveButton("Lưu", null)
            .setOnCancelListener(view -> finish())
            .create();
        dialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
        title.requestFocus();
        dialog.show();
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> submit());
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (title != null) state.putString("title", title.getText().toString());
    }

    private void submit() {
        if (opening) return;
        String value = title.getText().toString().trim();
        if (value.isEmpty()) {
            title.setError("Nhập tên chủ đề");
            return;
        }
        try {
            String payload = UUID.randomUUID() + "." + System.currentTimeMillis() + "."
                + encode(value.getBytes(StandardCharsets.UTF_8));
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(Base64.decode(getKey(), BASE64_FLAGS), "HmacSHA256"));
            String signature = encode(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
            opening = openInChrome("write-widget=" + payload + "." + signature);
            if (opening) finish();
        } catch (java.security.GeneralSecurityException error) {
            title.setError("Không gửi được chủ đề. Thử lại.");
        }
    }

    private String getKey() {
        android.content.SharedPreferences prefs = getSharedPreferences("widget", MODE_PRIVATE);
        String key = prefs.getString("key", null);
        if (key == null) {
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            key = encode(random);
            prefs.edit().putString("key", key).apply();
        }
        return key;
    }

    private static String encode(byte[] bytes) {
        return Base64.encodeToString(bytes, BASE64_FLAGS);
    }

    private boolean openInChrome(String fragment) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(ORIGIN + (fragment.isEmpty() ? "" : "#" + fragment)));
        intent.setPackage("com.android.chrome");
        try {
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "Cần cài hoặc bật Google Chrome để dùng widget Write", Toast.LENGTH_LONG).show();
            return false;
        }
    }
}
