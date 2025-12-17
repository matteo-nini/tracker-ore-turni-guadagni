<?php
require_once dirname(__DIR__) . '/config/database.php';

header('Content-Type: application/json');

try {
    $pdo = getDB();

    $stmt = $pdo->prepare("SELECT id, assigned_to_user_id, date, start_time, end_time, notes, status FROM global_shifts ORDER BY date DESC");
    $stmt->execute();
    $shifts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($shifts);
} catch (PDOException $e) {
    error_log("Global shifts fetch error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Errore durante il recupero dei turni']);
}