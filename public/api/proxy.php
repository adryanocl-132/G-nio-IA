<?php
/**
 * G-nio IA - Proxy Seguro para API Gemini
 * Compatível com Hostinger (PHP 7.4+)
 */

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); 
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// 1. Tenta pegar a chave de variáveis de ambiente do servidor
$apiKey = getenv('GEMINI_API_KEY');

// 2. Se não encontrar, tenta carregar do arquivo de config local (mais fácil na Hostinger)
if (!$apiKey && file_exists(__DIR__ . '/config.php')) {
    include __DIR__ . '/config.php'; 
    // O arquivo config.php deve definir a variável $apiKey
}

// 3. Se ainda não encontrar, tenta ler de um .env na raiz (se existir)
if (!$apiKey && file_exists(__DIR__ . '/../../.env')) {
    $lines = file(__DIR__ . '/../../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            if (trim($name) === 'GEMINI_API_KEY') {
                $apiKey = trim($value, " \"'");
                break;
            }
        }
    }
}

if (!$apiKey || $apiKey === "SUA_CHAVE_API_AQUI") {
    http_response_code(500);
    echo json_encode([
        "status" => "error", 
        "message" => "Chave de API não configurada. Por favor, edite o arquivo api/config.php na sua hospedagem."
    ]);
    exit;
}

$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Input JSON inválido"]);
    exit;
}

$model = $data['model'] ?? 'gemini-1.5-flash';
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
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); // Importante para segurança

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => curl_error($ch)]);
} else {
    http_response_code($httpCode);
    echo $response;
}

curl_close($ch);
