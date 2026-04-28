<?php
/**
 * G-nio IA - Gateway Seguro PHP
 * Este arquivo protege a chave API e faz a ponte com o Google Gemini.
 */

// 1. Configurações de Segurança e Headers
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); // Em produção, mude para seu domínio real
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// 2. Carregamento da Chave de API pela variável de ambiente do servidor
$apiKey = getenv('GEMINI_API_KEY');

if (!$apiKey) {
    http_response_code(500);
    echo json_encode([
        "error" => "Configuração de servidor incompleta.",
        "details" => "A variável de ambiente GEMINI_API_KEY não foi detectada no servidor PHP."
    ]);
    exit;
}

// 3. Processamento do Input do Frontend
$input = json_decode(file_get_contents("php://input"), true);
if (!$input || !isset($input['contents'])) {
    http_response_code(400);
    echo json_encode(["error" => "Requisição inválida: 'contents' é obrigatório."]);
    exit;
}

// 4. Preparação da chamada para o Google
$model = $input['model'] ?? 'gemini-1.5-flash';
$url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . $apiKey;

$payload = [
    "contents" => $input['contents'],
    "generationConfig" => $input['config'] ?? (object)[]
];

// 5. Execução via cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(["error" => "Falha na comunicação com Google: " . curl_error($ch)]);
} else {
    http_response_code($httpCode);
    echo $response;
}
curl_close($ch);
