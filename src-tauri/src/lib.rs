use tauri_plugin_sql::{Migration, MigrationKind};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_product_fields",
            sql: include_str!("../migrations/002_product_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_billing_tables",
            sql: include_str!("../migrations/003_billing.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "make_customer_phone_unique",
            sql: include_str!("../migrations/004_customer_phone_unique.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create_suppliers",
            sql: include_str!("../migrations/005_suppliers.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_purchases",
            sql: include_str!("../migrations/006_purchases.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "add_inventory_average_cost",
            sql: include_str!("../migrations/007_inventory_cost.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_invoice_item_cost_price",
            sql: include_str!("../migrations/008_invoice_cost.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "app settings",
            sql: "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "add_invoice_redone",
            sql: include_str!("../migrations/009_invoice_redone.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_bulk_units",
            sql: include_str!("../migrations/010_bulk_units.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "add_default_units",
            sql: include_str!("../migrations/011_default_units.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "add_invoice_tax_type",
            sql: include_str!("../migrations/012_invoice_tax_type.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "add_hsn_and_state",
            sql: include_str!("../migrations/013_hsn_and_state.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:hardware_store.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
