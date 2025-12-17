<?php
/**
 * Script di Migrazione Dati da File a Database
 * 
 * IMPORTANTE: Esegui questo script UNA SOLA VOLTA dopo aver creato le tabelle
 * URL: https://tuosito.com/migrate.php
 * 
 * Per sicurezza, elimina questo file dopo la migrazione
 */

// Configurazione Database
$db_host = 'localhost';
$db_name = 'dbpgngswdzl2ls';
$db_user = 'ufupufxp2wmgg';
$db_pass = '%@32<dige:h:';

// Connessione Database
try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4",
        $db_user,
        $db_pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
    echo "✅ Connessione database OK<br><br>";
} catch (PDOException $e) {
    die("❌ Errore connessione database: " . $e->getMessage());
}

// Percorsi File
$profilesFile = __DIR__ . '/profiles/profiles.json';
$calendarDir = __DIR__ . '/calendar';
$profilesDir = __DIR__ . '/profiles';

echo "<h2>🚀 Inizio Migrazione Dati</h2>";
echo "<pre>";

// ============================================
// 1. MIGRAZIONE UTENTI
// ============================================
echo "\n📋 STEP 1: Migrazione Utenti\n";
echo str_repeat("-", 50) . "\n";

if (!file_exists($profilesFile)) {
    die("❌ File profiles.json non trovato!");
}

$profiles = json_decode(file_get_contents($profilesFile), true);
$userIdMap = []; // Mappa username -> user_id

$stmtUser = $pdo->prepare("
    INSERT INTO users (username, password, role, created_at) 
    VALUES (:username, :password, :role, :created_at)
    ON DUPLICATE KEY UPDATE 
        password = VALUES(password),
        role = VALUES(role)
");

foreach ($profiles as $username => $data) {
    $role = isset($data['role']) ? $data['role'] : 'user';
    $created = isset($data['created']) ? $data['created'] : date('Y-m-d H:i:s');
    
    try {
        $stmtUser->execute([
            'username' => $username,
            'password' => $data['password'],
            'role' => $role,
            'created_at' => $created
        ]);
        
        $userId = $pdo->lastInsertId();
        if (!$userId) {
            // Se è un duplicate, prendi l'ID esistente
            $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $userId = $stmt->fetchColumn();
        }
        
        $userIdMap[$username] = $userId;
        echo "✅ Utente migrato: $username (ID: $userId, Ruolo: $role)\n";
    } catch (PDOException $e) {
        echo "❌ Errore migrazione utente $username: " . $e->getMessage() . "\n";
    }
}

echo "\nUtenti migrati: " . count($userIdMap) . "\n";

// ============================================
// 2. MIGRAZIONE IMPOSTAZIONI UTENTI
// ============================================
echo "\n📋 STEP 2: Migrazione Impostazioni Utenti\n";
echo str_repeat("-", 50) . "\n";

$stmtSettings = $pdo->prepare("
    INSERT INTO user_settings 
    (user_id, contract_start_date, weekly_hours, extra_rate, contract_rate) 
    VALUES (:user_id, :contract_start_date, :weekly_hours, :extra_rate, :contract_rate)
    ON DUPLICATE KEY UPDATE 
        contract_start_date = VALUES(contract_start_date),
        weekly_hours = VALUES(weekly_hours),
        extra_rate = VALUES(extra_rate),
        contract_rate = VALUES(contract_rate)
");

$settingsMigrated = 0;
foreach ($userIdMap as $username => $userId) {
    // Solo per utenti non admin
    if ($profiles[$username]['role'] === 'admin') continue;
    
    $settingsFile = "$profilesDir/$username/settings.json";
    
    if (file_exists($settingsFile)) {
        $settings = json_decode(file_get_contents($settingsFile), true);
        
        try {
            $stmtSettings->execute([
                'user_id' => $userId,
                'contract_start_date' => $settings['contractStartDate'] ?? '2024-10-21',
                'weekly_hours' => $settings['weeklyHours'] ?? 18,
                'extra_rate' => $settings['extraRate'] ?? 10,
                'contract_rate' => $settings['contractRate'] ?? null
            ]);
            
            echo "✅ Settings migrati: $username\n";
            $settingsMigrated++;
        } catch (PDOException $e) {
            echo "❌ Errore migrazione settings $username: " . $e->getMessage() . "\n";
        }
    } else {
        echo "⚠️  Settings non trovati per: $username (OK se è admin)\n";
    }
}

echo "\nSettings migrati: $settingsMigrated\n";

// ============================================
// 3. MIGRAZIONE TURNI PERSONALI
// ============================================
echo "\n📋 STEP 3: Migrazione Turni Personali\n";
echo str_repeat("-", 50) . "\n";

$stmtShift = $pdo->prepare("
    INSERT INTO shifts 
    (user_id, date, start_time, end_time, notes, status) 
    VALUES (:user_id, :date, :start_time, :end_time, :notes, :status)
");

$shiftsMigrated = 0;
foreach ($userIdMap as $username => $userId) {
    // Solo per utenti non admin
    if ($profiles[$username]['role'] === 'admin') continue;
    
    $shiftsFile = "$profilesDir/$username/shifts.csv";
    
    if (file_exists($shiftsFile)) {
        $csv = file_get_contents($shiftsFile);
        $lines = explode("\n", trim($csv));
        
        // Salta header
        for ($i = 1; $i < count($lines); $i++) {
            $line = trim($lines[$i]);
            if (empty($line)) continue;
            
            $parts = str_getcsv($line);
            if (count($parts) >= 5) {
                try {
                    $stmtShift->execute([
                        'user_id' => $userId,
                        'date' => $parts[0],
                        'start_time' => $parts[1],
                        'end_time' => $parts[2],
                        'notes' => $parts[3] ?? '',
                        'status' => $parts[4] ?? 'pending'
                    ]);
                    
                    $shiftsMigrated++;
                } catch (PDOException $e) {
                    echo "❌ Errore migrazione turno per $username: " . $e->getMessage() . "\n";
                }
            }
        }
        
        echo "✅ Turni migrati per $username: " . ($i - 1) . "\n";
    }
}

echo "\nTurni personali migrati: $shiftsMigrated\n";

// ============================================
// 4. MIGRAZIONE TURNI GLOBALI
// ============================================
echo "\n📋 STEP 4: Migrazione Turni Globali\n";
echo str_repeat("-", 50) . "\n";

$globalShiftsFile = "$calendarDir/global_shifts.json";
$globalShiftsMigrated = 0;

if (file_exists($globalShiftsFile)) {
    $globalShifts = json_decode(file_get_contents($globalShiftsFile), true);
    
    $stmtGlobal = $pdo->prepare("
        INSERT INTO global_shifts 
        (assigned_to_user_id, date, start_time, end_time, notes, status, created_by_user_id) 
        VALUES (:assigned_to, :date, :start_time, :end_time, :notes, :status, :created_by)
    ");
    
    foreach ($globalShifts as $shift) {
        $assignedUsername = $shift['assignedTo'];
        
        if (!isset($userIdMap[$assignedUsername])) {
            echo "⚠️  Utente non trovato per turno globale: $assignedUsername\n";
            continue;
        }
        
        try {
            $stmtGlobal->execute([
                'assigned_to' => $userIdMap[$assignedUsername],
                'date' => $shift['date'],
                'start_time' => $shift['start'],
                'end_time' => $shift['end'],
                'notes' => $shift['notes'] ?? '',
                'status' => $shift['status'] ?? 'pending',
                'created_by' => $userIdMap[$assignedUsername] // Default: assegnato a se stesso
            ]);
            
            $globalShiftsMigrated++;
        } catch (PDOException $e) {
            echo "❌ Errore migrazione turno globale: " . $e->getMessage() . "\n";
        }
    }
    
    echo "✅ Turni globali migrati: $globalShiftsMigrated\n";
} else {
    echo "⚠️  File global_shifts.json non trovato\n";
}

// ============================================
// 5. MIGRAZIONE LOGS
// ============================================
echo "\n📋 STEP 5: Migrazione Logs\n";
echo str_repeat("-", 50) . "\n";

$logsFile = "$calendarDir/changes_log.txt";
$logsMigrated = 0;

if (file_exists($logsFile)) {
    $logs = file($logsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    $stmtLog = $pdo->prepare("
        INSERT INTO change_logs 
        (user_id, action, entity_type, details, created_at) 
        VALUES (:user_id, :action, :entity_type, :details, :created_at)
    ");
    
    foreach ($logs as $log) {
        // Parse log: [2025-12-01 14:30:22] username ha aggiunto/modificato/eliminato...
        if (preg_match('/\[(.*?)\]\s+(\w+)\s+ha\s+(aggiunto|modificato|eliminato)/', $log, $matches)) {
            $timestamp = $matches[1];
            $username = $matches[2];
            $actionIta = $matches[3];
            
            // Mappa azione italiana -> inglese
            $actionMap = [
                'aggiunto' => 'add',
                'modificato' => 'edit',
                'eliminato' => 'delete'
            ];
            $action = $actionMap[$actionIta] ?? 'add';
            
            if (isset($userIdMap[$username])) {
                try {
                    $stmtLog->execute([
                        'user_id' => $userIdMap[$username],
                        'action' => $action,
                        'entity_type' => 'global_shift',
                        'details' => $log,
                        'created_at' => $timestamp
                    ]);
                    
                    $logsMigrated++;
                } catch (PDOException $e) {
                    // Ignora errori di log
                }
            }
        }
    }
    
    echo "✅ Logs migrati: $logsMigrated\n";
} else {
    echo "⚠️  File changes_log.txt non trovato\n";
}

// ============================================
// RIEPILOGO FINALE
// ============================================
echo "\n" . str_repeat("=", 50) . "\n";
echo "🎉 MIGRAZIONE COMPLETATA!\n";
echo str_repeat("=", 50) . "\n";
echo "Utenti:          " . count($userIdMap) . "\n";
echo "Settings:        " . $settingsMigrated . "\n";
echo "Turni personali: " . $shiftsMigrated . "\n";
echo "Turni globali:   " . $globalShiftsMigrated . "\n";
echo "Logs:            " . $logsMigrated . "\n";
echo str_repeat("=", 50) . "\n";

echo "\n✅ Verifica i dati su phpMyAdmin";
echo "\n⚠️  IMPORTANTE: Elimina questo file (migrate.php) dopo la migrazione!";
echo "\n⚠️  BACKUP: I file originali sono ancora in /profiles e /calendar\n";

echo "</pre>";
?>