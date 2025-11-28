<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username'])) {
    echo json_encode(['success' => false, 'message' => 'Username mancante']);
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $data['username']);
$profilesFile = dirname(__DIR__) . '/profiles/profiles.json';
$userDir = dirname(__DIR__) . '/profiles/' . $username;

// Remove user from profiles.json
if (file_exists($profilesFile)) {
    $profiles = json_decode(file_get_contents($profilesFile), true);
    
    if (isset($profiles[$username])) {
        unset($profiles[$username]);
        file_put_contents($profilesFile, json_encode($profiles, JSON_PRETTY_PRINT));
    }
}

// Remove user directory
function deleteDirectory($dir) {
    if (!is_dir($dir)) {
        return false;
    }
    
    $files = array_diff(scandir($dir), ['.', '..']);
    
    foreach ($files as $file) {
        $path = $dir . '/' . $file;
        is_dir($path) ? deleteDirectory($path) : unlink($path);
    }
    
    return rmdir($dir);
}

if (is_dir($userDir)) {
    deleteDirectory($userDir);
}

echo json_encode(['success' => true]);
?>