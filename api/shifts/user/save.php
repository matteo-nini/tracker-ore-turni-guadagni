<?php
// Anti-cache headers
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once dirname(__DIR__) . '/config/database.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username']) || !isset($data['shifts'])) {
    echo json_encode(['success' => false, 'message' => 'Dati mancanti']);
    exit;
}

$username = trim($data['username']);
$shifts = $data['shifts'];

try {
    $pdo = getDB();

    // Get user ID
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Utente non trovato']);
        exit;
    }

    $userId = $user['id'];

    // Begin transaction
    $pdo->beginTransaction();

    // Delete existing shifts
    $stmt = $pdo->prepare("DELETE FROM shifts WHERE user_id = ?");
    $stmt->execute([$userId]);

    // Insert new shifts
    $stmt = $pdo->prepare("INSERT INTO shifts (user_id, date, start_time, end_time, notes, status) VALUES (?, ?, ?, ?, ?, ?)");

    foreach ($shifts as $shift) {
        $stmt->execute([
            $userId,
            $shift['date'],
            $shift['start_time'],
            $shift['end_time'],
            $shift['notes'],
            $shift['status']
        ]);
    }

    $pdo->commit();

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("User shift save error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Errore durante il salvataggio']);
}
?>