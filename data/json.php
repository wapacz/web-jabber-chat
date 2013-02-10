<?
if(!isset($_GET['action'])) die(json_encode(null));

$username="root";
$password="its2012";
$database="ext_db";

switch($_GET['action']) {
    case 'get':
        if(isset($_GET['contacts'])) {

            $mysqli = new mysqli("localhost", $username, $password, $database);
            if ($result = $mysqli->query("SELECT contact AS username FROM contacts WHERE username='".$_GET['contacts']."'")) {

                $result_array = array();
                while ($row = $result->fetch_assoc()) {
                    array_push($result_array, $row);
                }
                
                echo json_encode($result_array);
                
                $result->free();
            }

            $mysqli->close();
        }
        else {
            echo json_encode(null);
        }
        break;
        
    case 'set':
        if(!isset($_GET['login'])) die(json_encode(null));
        if(!isset($_GET['password'])) die(json_encode(null));
        $mysqli = new mysqli("localhost", $username, $password, $database);
        if($result = $mysqli->query("SELECT * FROM accounts WHERE login='".$_GET['login']."'")) {
            if(count($result->fetch_assoc()) > 0) { // check if user exists
                $mysqli->query("UPDATE accounts SET password = '".MD5($_GET['password'])."' WHERE login = '".$_GET['login']."'");
                echo "{'result':'user updated'}";
            }
            else {
                $mysqli->query("INSERT INTO accounts (login, password) VALUES ('".$_GET['login']."','".MD5($_GET['password'])."')");
                echo "{'result':'user added'}";
            }
            $result->free();
        }
        $mysqli->close();
        break;
        
    case 'delete':
        if(!isset($_GET['login'])) die(json_encode(null));
        $mysqli = new mysqli("localhost", $username, $password, $database);
        $mysqli->query("DELETE FROM accounts WHERE login = '".$_GET['login']."'");
        $mysqli->close();
        echo "{'result':'user deleted'}";
        break;

    case 'set_contact':
        if(!isset($_GET['login'])) die(json_encode(null));
        if(!isset($_GET['contact'])) die(json_encode(null));
        $mysqli = new mysqli("localhost", $username, $password, $database);
        $mysqli->query("INSERT INTO contacts (contact, username) VALUES ('".$_GET['contact']."','".$_GET['login']."')");
        $mysqli->close();
        echo "{'result':'contact added'}";
        break;
        
    case 'delete_contact':
        if(!isset($_GET['login'])) die(json_encode(null));
        if(!isset($_GET['contact'])) die(json_encode(null));
        $mysqli = new mysqli("localhost", $username, $password, $database);
        $mysqli->query("DELETE FROM contacts WHERE (contact = '".$_GET['contact']."' AND username = '".$_GET['login']."')");
        $mysqli->close();
        echo "{'result':'contact deleted'}";
        break;     
}
?>
