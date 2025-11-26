<?php
// Salva impostazioni per profilo
$profile = isset($_GET['profile']) ? preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['profile']) : '';
if (!$profile) { http_response_code(400); echo 'Profilo mancante'; exit; }
$file = __DIR__ . "/../profiles/{$profile}/settings.json";
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = file_get_contents('php://input');
    file_put_contents($file, $data);
    echo 'OK';
    exit;
}
if (file_exists($file)) {
    header('Content-Type: application/json');
    readfile($file);
} else {
    echo json_encode([]);
}
