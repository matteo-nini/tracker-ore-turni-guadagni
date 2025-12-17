<?php
/**
 * Configurazione Database
 * 
 * Crea una cartella /config/ nella root e salva questo file come database.php
 */

// Configurazione Database
define('DB_HOST', 'localhost');
define('DB_NAME', 'dbpgngswdzl2ls');
define('DB_USER', 'ufupufxp2wmgg');
define('DB_PASS', '%@32<dige:h:');
define('DB_CHARSET', 'utf8mb4');

// Classe Singleton per Database
class Database {
    private static $instance = null;
    private $pdo;
    
    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET
            ];
            
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            // Log error e mostra messaggio generico
            error_log("Database connection error: " . $e->getMessage());
            die(json_encode(['success' => false, 'message' => 'Errore connessione database']));
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->pdo;
    }
    
    // Prevent cloning
    private function __clone() {}
    
    // Prevent unserialize
    public function __wakeup() {
        throw new Exception("Cannot unserialize singleton");
    }
}

// Helper function per ottenere connessione
function getDB() {
    return Database::getInstance()->getConnection();
}
?>