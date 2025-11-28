<?php
header('Content-Type: text/csv');
header('Access-Control-Allow-Origin: *');

if (!isset($_GET['username'])) {
    echo "Data,Entrata,Uscita,Note,Stato\n";
    exit;
}

$username = preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['username']); // Sanitize
$shiftsFile = dirname(__DIR__) . '/profiles/' . $username . '/shifts.csv';

if (!file_exists($shiftsFile)) {
    echo "Data,Entrata,Uscita,Note,Stato\n";
    exit;
}

echo file_get_contents($shiftsFile);
?>