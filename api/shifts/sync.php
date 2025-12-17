<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');

require_once dirname(__DIR__) . '/config/database.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username'])) {
    echo json_encode(['success' => false, 'message' => 'Username mancante']);
    exit;
}

$username = trim($data['username']);

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

    // Get user shifts
    $stmt = $pdo->prepare("SELECT date, start_time, end_time, notes, status FROM shifts WHERE user_id = ?");
    $stmt->execute([$userId]);
    $userShifts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get global shifts
    $stmt = $pdo->prepare("SELECT date, start_time, end_time, notes, status, assigned_to_user_id FROM global_shifts");
    $stmt->execute();
    $globalShifts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Add user shifts to global shifts if not already present
    $added = 0;
    foreach ($userShifts as $userShift) {
        $exists = false;

        foreach ($globalShifts as $globalShift) {
            if ($globalShift['date'] === $userShift['date'] &&
                $globalShift['start_time'] === $userShift['start_time'] &&
                $globalShift['end_time'] === $userShift['end_time'] &&
                $globalShift['assigned_to_user_id'] === $userId) {
                $exists = true;
                break;
            }
        }

        if (!$exists) {
            $stmt = $pdo->prepare("INSERT INTO global_shifts (assigned_to_user_id, date, start_time, end_time, notes, status, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $userId,
                $userShift['date'],
                $userShift['start_time'],
                $userShift['end_time'],
                $userShift['notes'],
                $userShift['status'],
                $userId
            ]);
            $added++;
        }
    }

    echo json_encode([
        'success' => true,
        'added' => $added,
        'message' => $added > 0 ? "{$added} turni sincronizzati" : "Nessun nuovo turno da sincronizzare"
    ]);
} catch (PDOException $e) {
    error_log("Sync shifts error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Errore durante la sincronizzazione']);
}
?>