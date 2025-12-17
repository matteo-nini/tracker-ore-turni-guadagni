<?php
// Anti-cache headers
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');

header('Content-Type: text/csv');
header('Access-Control-Allow-Origin: *');

require_once dirname(__DIR__) . '/config/database.php';

if (!isset($_GET['username']) || empty(trim($_GET['username']))) {
    echo "Errore: username non specificato\n";
    echo "Data,Entrata,Uscita,Note,Stato\n";
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['username']);

try {
    $pdo = getDB();
    
    // Get user ID
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    
    if (!$user) {
        echo "Errore: utente non trovato\n";
        echo "Data,Entrata,Uscita,Note,Stato\n";
        exit;
    }
    
    // Get user shifts
    $stmt = $pdo->prepare("
        SELECT date, start_time, end_time, notes, status 
        FROM shifts 
        WHERE user_id = ? 
        ORDER BY date DESC
    ");
    $stmt->execute([$user['id']]);
    $shifts = $stmt->fetchAll();
    
    // Output CSV
    echo "Data,Entrata,Uscita,Note,Stato\n";
    
    foreach ($shifts as $shift) {
        echo sprintf(
            "%s,%s,%s,%s,%s\n",
            $shift['date'],
            $shift['start_time'],
            $shift['end_time'],
            str_replace(',', ';', $shift['notes'] ?? ''), // Escape commas
            $shift['status']
        );
    }
    
} catch (PDOException $e) {
    error_log("Get shifts error: " . $e->getMessage());
    echo "Errore: impossibile recuperare i turni\n";
    echo "Data,Entrata,Uscita,Note,Stato\n";
}
?>