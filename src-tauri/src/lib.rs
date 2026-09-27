use std::{fs, path::PathBuf};

use serde_json::Value;
use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

const DEFAULT_LADDER: &str = include_str!("../default-ladder.json");
const WINDOW_STATE_FILE: &str = ".window-state.json";

/// %APPDATA%\com.ahmad.incomeladder\ladder.json — created from the default on first run.
fn ladder_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("ladder.json");
    if !path.exists() {
        fs::write(&path, DEFAULT_LADDER).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

/// Change one top-level field and keep everything else in the file as it was.
fn patch_json(text: &str, pointer: &str, value: Value) -> Result<String, String> {
    let mut doc: Value =
        serde_json::from_str(text).map_err(|e| format!("ladder.json is not valid JSON: {e}"))?;
    let (parent, key) = pointer.rsplit_once('/').unwrap_or(("", pointer));
    let target = if parent.is_empty() { Some(&mut doc) } else { doc.pointer_mut(parent) };
    match target {
        Some(Value::Object(map)) => {
            map.insert(key.to_string(), value);
        }
        _ => {
            // missing parent object (e.g. no "settings" yet): create it
            let obj = doc.as_object_mut().ok_or("ladder.json must be an object")?;
            let name = parent.trim_start_matches('/');
            obj.entry(name).or_insert_with(|| Value::Object(Default::default()));
            obj[name][key] = value;
        }
    }
    serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())
}

fn update_ladder(app: &AppHandle, pointer: &str, value: Value) -> Result<(), String> {
    let path = ladder_path(app)?;
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let out = patch_json(&text, pointer, value)?;
    fs::write(&path, out + "\n").map_err(|e| e.to_string())
}

fn read_setting_bool(app: &AppHandle, pointer: &str) -> bool {
    ladder_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .and_then(|v| v.pointer(pointer).and_then(Value::as_bool))
        .unwrap_or(false)
}

#[tauri::command]
fn read_ladder(app: AppHandle) -> Result<String, String> {
    fs::read_to_string(ladder_path(&app)?).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_current(app: AppHandle, amount: u64) -> Result<(), String> {
    update_ladder(&app, "/current", Value::from(amount))
}

fn snap_bottom_right(app: &AppHandle) {
    let Some(win) = app.get_webview_window("main") else { return };
    let (Ok(Some(mon)), Ok(size)) = (win.current_monitor(), win.outer_size()) else { return };
    let area = mon.work_area();
    let margin = (16.0 * mon.scale_factor()) as i32;
    let x = area.position.x + area.size.width as i32 - size.width as i32 - margin;
    let y = area.position.y + area.size.height as i32 - size.height as i32 - margin;
    let _ = win.set_position(PhysicalPosition::new(x, y));
}

/// A saved position can end up off-screen (monitor unplugged, window grew taller).
fn fully_on_screen(app: &AppHandle) -> bool {
    let Some(win) = app.get_webview_window("main") else { return true };
    let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) else { return true };
    let Ok(monitors) = win.available_monitors() else { return true };
    monitors.iter().any(|m| {
        let a = m.work_area();
        pos.x >= a.position.x
            && pos.y >= a.position.y
            && pos.x + size.width as i32 <= a.position.x + a.size.width as i32
            && pos.y + size.height as i32 <= a.position.y + a.size.height as i32
    })
}

fn show_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![read_ladder, set_current])
        .setup(|app| {
            let handle = app.handle().clone();

            // first run: no saved position yet, so park it bottom-right
            let first_run = app
                .path()
                .app_config_dir()
                .map(|d| !d.join(WINDOW_STATE_FILE).exists())
                .unwrap_or(true);
            if first_run || !fully_on_screen(&handle) {
                snap_bottom_right(&handle);
            }

            let on_top = read_setting_bool(&handle, "/settings/alwaysOnTop");
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_always_on_top(on_top);
            }

            let edit = MenuItemBuilder::with_id("edit", "Edit amount…").build(app)?;
            let open = MenuItemBuilder::with_id("open", "Open ladder.json").build(app)?;
            let top = CheckMenuItemBuilder::with_id("top", "Always on top").checked(on_top).build(app)?;
            let auto = CheckMenuItemBuilder::with_id("auto", "Start with Windows")
                .checked(app.autolaunch().is_enabled().unwrap_or(false))
                .build(app)?;
            let snap = MenuItemBuilder::with_id("snap", "Move to corner").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&edit, &open])
                .separator()
                .items(&[&top, &auto, &snap])
                .separator()
                .item(&quit)
                .build()?;

            let top_item = top.clone();
            let auto_item = auto.clone();
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Income Ladder")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "edit" => {
                        show_main(app);
                        let _ = app.emit_to("main", "edit-amount", ());
                    }
                    "open" => {
                        if let Ok(p) = ladder_path(app) {
                            let _ = app.opener().open_path(p.to_string_lossy(), None::<&str>);
                        }
                    }
                    "top" => {
                        let on = top_item.is_checked().unwrap_or(false);
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.set_always_on_top(on);
                        }
                        let _ = update_ladder(app, "/settings/alwaysOnTop", Value::Bool(on));
                    }
                    "auto" => {
                        let al = app.autolaunch();
                        let _ = if auto_item.is_checked().unwrap_or(false) { al.enable() } else { al.disable() };
                    }
                    "snap" => snap_bottom_right(app),
                    "quit" => {
                        let _ = app.save_window_state(StateFlags::POSITION);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn patch_keeps_other_fields() {
        let out = patch_json(r#"{"current":1,"goal":10000,"milestones":[1,2]}"#, "/current", 2800.into()).unwrap();
        let v: Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["current"], 2800);
        assert_eq!(v["goal"], 10000);
        assert_eq!(v["milestones"], serde_json::json!([1, 2]));
    }

    #[test]
    fn patch_creates_missing_settings() {
        let out = patch_json(r#"{"current":1}"#, "/settings/alwaysOnTop", true.into()).unwrap();
        let v: Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["settings"]["alwaysOnTop"], true);
    }

    #[test]
    fn patch_rejects_broken_json() {
        assert!(patch_json("{ nope", "/current", 1.into()).is_err());
    }

    #[test]
    fn default_ladder_is_valid() {
        let v: Value = serde_json::from_str(DEFAULT_LADDER).unwrap();
        assert_eq!(v["current"], 2800);
        assert_eq!(v["goal"], 10000);
    }
}
