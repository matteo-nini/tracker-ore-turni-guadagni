<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');

$profilesFile = dirname(__DIR__) . '/profiles/profiles.json';

if (!file_exists($profilesFile)) {
    echo json_encode([]);
    exit;
}

$profiles = json_decode(file_get_contents($profilesFile), true);

// Extract only usernames and roles (exclude admins from assignable users)
$users = [];
foreach ($profiles as $username => $data) {
    if (isset($data['role']) && $data['role'] === 'user') {
        $users[] = [
            'username' => $username,
            'role' => $data['role']
        ];
    }
}

echo json_encode($users);
?>