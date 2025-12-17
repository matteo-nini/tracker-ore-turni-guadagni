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

if (!isset($data['username']) || !isset($data['password'])) {
    echo json_encode(['success' => false, 'message' => 'Dati mancanti']);
    exit;
}

$username = trim($data['username']);
$password = $data['password'];
$role = isset($data['role']) ? $data['role'] : 'user';

// Validate username
if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
    echo json_encode(['success' => false, 'message' => 'Username non valido (3-20 caratteri, solo lettere, numeri e underscore)']);
    exit;
}

// Validate role
if (!in_array($role, ['user', 'admin'])) {
    $role = 'user';
}

try {
    $pdo = getDB();
    
    // Check if username exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Username già esistente']);
        exit;
    }
    
    // Begin transaction
    $pdo->beginTransaction();
    
    // Insert user
    $stmt = $pdo->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
    $stmt->execute([
        $username,
        password_hash($password, PASSWORD_DEFAULT),
        $role
    ]);
    
    $userId = $pdo->lastInsertId();
    
    // Create default settings for non-admin users
    if ($role === 'user') {
        $stmt = $pdo->prepare("
            INSERT INTO user_settings (user_id, contract_start_date, weekly_hours, extra_rate) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([
            $userId,
            '2024-10-21',
            18.00,
            10.00
        ]);
    }
    
    $pdo->commit();
    
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Register error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Errore durante la registrazione']);
}
?>