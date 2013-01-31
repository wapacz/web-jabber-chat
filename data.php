<?php
$rooms = array(
    array('name'=>'Drużyna1'),
    array('name'=>'Drużyna3'),
    array('name'=>'Drużyna2'),
    array('name'=>'Drużyna4')
);
$users = array(
    array('jid'=>'user1@ks357566.kimsufi.com', 'password'=>'user1', 'username'=>'user1'),
    array('jid'=>'user3@ks357566.kimsufi.com', 'password'=>'user3', 'username'=>'user3'),
    array('jid'=>'user4@ks357566.kimsufi.com', 'password'=>'user4', 'username'=>'user4'),
    array('jid'=>'user2@ks357566.kimsufi.com', 'password'=>'user2', 'username'=>'user2')
);

if(isset($_GET['username'])) {
    $found_user = null;
    foreach($users as $user) {
        if($user['username'] === $_GET['username']) {
            $found_user = $user;
            break;
        }
    }
    echo json_encode($found_user);
}
else if(isset($_GET['all'])) {
    switch($_GET['all']) {
        case 'users':
            echo json_encode($users);
            break;
        case 'rooms':
            echo json_encode($rooms);
            break;
        default:
            echo json_encode(null);
    }
}
else if(isset($_GET['contacts'])) {

    $username="root";
    $password="its2012";
    $database="ext_db";

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

?>
