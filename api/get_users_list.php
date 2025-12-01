<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

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