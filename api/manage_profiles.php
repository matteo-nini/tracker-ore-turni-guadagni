<?php

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');

// Gestione profili: carica/salva profili
$profilesFile = __DIR__ . '/../profiles/profiles.json';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = file_get_contents('php://input');
    file_put_contents($profilesFile, $data);
    echo 'OK';
    exit;
}
if (file_exists($profilesFile)) {
    header('Content-Type: application/json');
    readfile($profilesFile);
} else {
    echo json_encode([]);
}
