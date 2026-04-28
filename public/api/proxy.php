<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$apiKey = getenv('GEMINI_API_KEY');
if (!$apiKey && file_exists(__DIR__ . '/../../.env')) {
    $env = parse_ini_file(__DIR__ . '/../../.env');
    $apiKey = $env['GEMINI_API_KEY'] ?? '';
}

// Fallback to hardcoded key if necessary (Not recommended but for Hostinger users often easiest)
// $apiKey = "YOUR_API_KEY_HERE";

if (!$apiKey) {
    http_response_code(500);
    echo json_encode(["error" => "API Key not configured"]);
    exit;
}

$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON input"]);
    exit;
}

$model = $data['model'] ?? 'gemini-3-flash-preview';
$contents = $data['contents'] ?? [];
$config = $data['config'] ?? (object)[];

$payload = [
    "contents" => $contents,
    "generationConfig" => $config
];

$url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$apiKey";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(["error" => curl_error($ch)]);
} else {
    http_response_code($httpCode);
    echo $response;
}

curl_close($ch);
