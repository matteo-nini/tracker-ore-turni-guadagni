<?php
require_once dirname(__DIR__) . '/config/database.php';

header('Content-Type: application/json');

if (!isset($_GET['username'])) {
    echo json_encode(['error' => 'Username mancante']);
    exit;
}

$username = trim($_GET['username']);

try {
    $pdo = getDB();

    // Check if user is admin
    $stmt = $pdo->prepare("SELECT role FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || $user['role'] !== 'admin') {
        echo json_encode(['error' => 'Accesso negato']);
        exit;
    }

    // Fetch logs
    $stmt = $pdo->prepare("SELECT details, created_at FROM change_logs ORDER BY created_at DESC");
    $stmt->execute();
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['logs' => $logs]);
} catch (PDOException $e) {
    error_log("Logs fetch error: " . $e->getMessage());
    echo json_encode(['error' => 'Errore durante il recupero dei log']);
}
?>