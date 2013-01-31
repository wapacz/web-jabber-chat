/*
 * @Description: It is XMPP chat plugin for jQuery. Using Strophe.
 * @Author: Michal Lapacz
 * @Date: 21.01.2013
 */
(function ($) {
    var App = {
        ConnectionStatus: {
            AVAILABLE: 0,
            INPROGRESS: 1,
            UNAVAILABLE: 2
        },
        options: {
            bosh_service : 'http-bind/',
            domain: ''
        },
        chatList: null,
        xmppConnection : null,
        
        init : function(options) {
            
            Strophe.log = function (level, msg) {
              App.log('['+level+']: '+msg);
            }
                                
            var container = this;
            container.addClass('chat-container');
            
            App.chatList = new ChatList(container);
            container.append(App.chatList.Get$());
            
            App.chatList.Minimize();
        },
        log : function (msg) {
            var log = $('#log');
            log.append('<div></div>').append(document.createTextNode(msg));
            log.scrollTop(log[0].scrollHeight - log.height());
            
        },
        rawInput : function (data) {
            App.log('RECV: ' + data);
        },
        rawOutput : function (data) {
            App.log('SENT: ' + data);
        },
        login : function () {
            
            var userCredentials = {
                jid : App.options.login+'@'+App.options.domain,
                username : App.options.login,
                password : App.options.password
            };
            
            App.chatList.SetUserCredentials(userCredentials);
            
            App.xmppConnection = new Strophe.Connection(App.options.bosh_service);
            App.xmppConnection.rawInput = App.rawInput;
            App.xmppConnection.rawOutput = App.rawOutput;
            App.xmppConnection.connect(
                userCredentials.jid,
                userCredentials.password,
                App.OnConnect
            );
        },
        logout : function () {
            App.xmppConnection.disconnect();
            App.chatList.OnDisconnect();
        },
        OnConnect : function (status) {
            
            switch(status) {
                case Strophe.Status.CONNECTING:
                case Strophe.Status.AUTHENTICATING:
                    App.chatList.OnConnectionStateChanged(App.ConnectionStatus.INPROGRESS);
                    break;
                    
                case Strophe.Status.CONNFAIL:
                case Strophe.Status.DISCONNECTING:
                case Strophe.Status.DISCONNECTED:
                case Strophe.Status.AUTHFAIL:
                    App.chatList.OnConnectionStateChanged(App.ConnectionStatus.UNAVAILABLE);
                    break;
                    
                case Strophe.Status.CONNECTED:
                    App.chatList.OnConnectionStateChanged(App.ConnectionStatus.AVAILABLE);
                    App.xmppConnection.addHandler(App.OnMessage, null, 'message', null, null,  null); 
                    App.xmppConnection.addHandler(App.OnSubscriptionRequest, null, 'presence', 'subscribe');
                    App.xmppConnection.addHandler(App.OnPresence, null, 'presence');
                    App.xmppConnection.send($pres().tree());
                    //App.xmppConnection.send($pres().c('show').t('away').up().c('status').t('reading'));
                    break;
                    
                case Strophe.Status.ATTACHED:
                    App.chatList.OnConnectionStateChanged(App.ConnectionStatus.AVAILABLE); //????? moze osobny order code
                    break;
                    
                default:
                    App.chatList.OnConnectionStateChanged(App.ConnectionStatus.UNAVAILABLE);
                    break;
            }
        },
        OnMessage : function (msg) {

            var to = msg.getAttribute('to');
            var from = msg.getAttribute('from');
            var type = msg.getAttribute('type');
            var elems = msg.getElementsByTagName('body');
            
            App.log(type + ':::' + Strophe.getBareJidFromJid(from));
            
            if (type == "chat" && elems.length > 0) {
                var body = elems[0];

                App.log('ECHOBOT: I got a message from ' + Strophe.getBareJidFromJid(from) + ': ' + Strophe.getText(body));
                
                App.chatList.OnMessage(
                                Strophe.getBareJidFromJid(from), 
                                Strophe.getNodeFromJid(from), 
                                Strophe.getText(body)
                              );
            }

            // we must return true to keep the handler alive.  
            // returning false would remove it after it finishes.
            return true;
        },
        OnSubscriptionRequest : function (presence) {
            
            var to = presence.getAttribute('to');
            var from = presence.getAttribute('from');
            var type = presence.getAttribute('type');
            
            App.log('Subscribe request sent: '+Strophe.getBareJidFromJid(from));
            
            if(type == "subscribe")
            {
                App.log("Presence accepted");
                App.xmppConnection.send($pres({ to: Strophe.getBareJidFromJid(from), type: "subscribed" }));
            }
            return true;
        },
        OnPresence : function (presence) {
            
            var to = presence.getAttribute('to');
            var from = presence.getAttribute('from');
            var type = presence.getAttribute('type');
            
            App.log('Presence: '+Strophe.getBareJidFromJid(from));
        
            App.chatList.OnPresence(
                                Strophe.getBareJidFromJid(from),
                                Strophe.getNodeFromJid(from),
                                type
                            );
        
            // we must return true to keep the handler alive.  
            // returning false would remove it after it finishes.
            return true;
        },
        SendMessage : function (jid, msg) {
            
            if (App.xmppConnection.connected && App.xmppConnection.authenticated) {
                //var text = $('#' + elemid).get(0).value;
                if (msg.length > 0) {
                    //var from = Strophe.getNodeFromJid(App.connection.jid);
                    //var to = 'user2@big';

                    var reply = $msg({
                            to : jid, //Strophe.getDomainFromJid(jid), // TODO: get whole jid
                            from : App.xmppConnection.jid,
                            type : "chat"
                        }).c("body").t(msg);
                    
                    App.xmppConnection.send(reply.tree());
                    App.log(msg, "from");
                }
            } else {
                App.log("You have to log in before you can send msg");
            }
        }        
    };

    var ChatList = function(container) {
    
        var self = this;
        
        /*
         * class fields
         */
        self.users = [];
        self.userCredentials = null;
        self.username = null;
        self.isMinimized = false;
        self.selectedUsers = [];
        
        /*
         * class fields GUI
         */
        self.chatContainer = container;
        self.chatBoxes = [];
        
        self.contextMenu = 
            $('<ul>').hide()
                .append($('<li>')
                    .append($('<a>')
                        .attr({'href':'#'})
                        .text('Prywatny')
                        .append($('<span>').addClass('ui-icon ui-icon-person'))
                    )
                    .click(function () {
                        self.contextMenu.hide();
                        self.ShowChatBox(
                                self.contextMenu.data('selectedUser').jid, 
                                self.contextMenu.data('selectedUser').username
                            );
                    })
                    .bind('contextmenu', function () {
                        self.contextMenu.hide();
                        return false;
                    })
                )
                .append($('<li>')
                    .append($('<a>')
                        .attr({'href':'#'})
                        .text('Grupa')
                        .append($('<span>').addClass('ui-icon ui-icon-comment'))
                    )
                    .click(function () {
                        self.contextMenu.hide();
                        
                        // if(self.selectedUsers.length > 0) {
                            // App.xmppConnection.
                        // }
                    })
                    .bind('contextmenu', function () {
                        self.contextMenu.hide();
                        return false;
                    })
                )
                .css({
                    left : '0px',
                    top : '0px',
                    position : 'absolute',
                    width: '100px'
                })
                .appendTo(document.body)
                .menu();
        
        
        self.chatList = $('<div>').addClass('chat-list');
        self.chatListHeader = $('<div>')
                                .addClass('chat-list-header')
                                .dblclick(function() {
                                    if(self.isMinimized)
                                        self.Maximize();
                                    else
                                        self.Minimize();
                                });
        self.chatListMain = $('<div>').addClass('chat-list-main');
        self.chatListFooter = $('<div>').addClass('chat-list-footer');
        
        self.chatList.append(self.chatListHeader);
        self.chatList.append(self.chatListMain);
        self.chatList.append(self.chatListFooter);
        
        self.userLoginIcon = $('<div>').addClass('chat-list-user-notactive');
        self.chatListHeader.append(self.userLoginIcon);
        
        self.chatListHeaderText = $('<div>')
                                    .addClass('chat-list-header-text')
                                    .html('Niepołączony');
                                    
        self.chatListHeader.append(self.chatListHeaderText);
                 
        var headerIcons = $('<div>').addClass('chat-list-header-icons');

        // minimize box
        self.minimizeBox = $('<div>')
                                .addClass('chat-list-icon ui-corner-all')
                                .append($('<span>').addClass('ui-icon ui-icon-triangle-1-s'))
                                .attr({'title': 'Minimalizuj'})
                                .click(function(){
                                    self.Minimize();
                                });
        headerIcons.append(self.minimizeBox);
        
        

        // maximize box
        self.maximizeBox = $('<div>')
                                .addClass('chat-list-icon ui-corner-all')
                                .append($('<span>').addClass('ui-icon ui-icon-triangle-1-n'))
                                .attr({'title': 'Pokaż czat'})
                                .hide()
                                .click(function(){
                                    self.Maximize();
                                });
        headerIcons.append(self.maximizeBox);
        
        // login/logout box
        self.loginBox = $('<div>')
                                .addClass('chat-list-icon ui-corner-all')
                                .append($('<span>').addClass('ui-icon ui-icon ui-icon-power'))
                                .attr({'title' : 'Wyloguj'})
                                .click(function(){
                                    if(App.xmppConnection.connected) {
                                        App.logout();
                                        self.loginBox.attr({'title': 'Zaloguj'});
                                    }
                                    else {
                                        App.login();
                                        self.loginBox.attr({'title': 'Wyloguj'});
                                    }
                                });
        headerIcons.append(self.loginBox);
        
        // if(App.xmppConnection.connected) {
            // self.loginBox.attr({'title' : 'Wyloguj'});
        // }
        // else {
            // self.loginBox.attr({'title' : 'Zaloguj'});
        // }        
        
        self.chatListHeader.append(headerIcons)
        
        self.chatListUserList = $('<ol>').addClass('chat-list-userlist').selectable({cancel: '.ui-selected'});
        self.chatListMain.append(self.chatListUserList);
    }
    
    ChatList.prototype.Get$ = function () {
        return this.chatList;
    }
    
    ChatList.prototype.Minimize = function () {
    	
    	var self = this;
    	self.maximizeBox.show();
    	self.minimizeBox.hide();
    	self.chatListFooter.hide();
    	self.chatListMain.hide();
    	self.chatList.removeClass('chat-list-maximized');
    	self.chatList.addClass('chat-list-minimized');
        
        self.isMinimized = true;
    }
    
    ChatList.prototype.Maximize = function () {
    	
    	var self = this;
    	self.maximizeBox.hide();
    	self.minimizeBox.show();
    	self.chatListFooter.show();
    	self.chatListMain.show();
    	self.chatList.removeClass('chat-list-minimized');
    	self.chatList.addClass('chat-list-maximized');
        
        self.isMinimized = false;
    }
    
    ChatList.prototype.Destroy = function () {
    	
    	var self = this;
        
    	self.maximizeList.hide();
    	self.minimizeList.hide();
    	self.chatListFooter.hide();
    	self.chatListMain.hide();
    	self.chatList.hide();
        
        // //delete self.chatBoxes.remove();  ///////////////
        
        delete self.isMinimized;
        delete self.chatList;
        delete self.chatListMain;
        delete self.chatListFooter;
        delete self.chatListHeader;
        delete self.minimizeBox;
        delete self.maximizeBox;
        delete self.chatList;
        delete self;
    }
    
    ChatList.prototype.OnDisconnect = function () {
        
        //var self = this;
        //self.ClearUserList();
    }
    
    ChatList.prototype.ShowChatBox = function (id, username) {
        
        var self = this;
        
        if(!App.xmppConnection.connected) return;
        if(!App.xmppConnection.authenticated) return;
        
        var chatBoxFound = false;
        for(var i=0; i<self.chatBoxes.length; i++) {
            var chatBox = self.chatBoxes[i];
            if(chatBox.jid == id) {
                chatBoxFound = true;
                chatBox.Get$().show();
                chatBox.Maximize();
                break;
            }
        }
        
        if(!chatBoxFound) {
            var chatBox = new ChatBox(self, id, username);
            self.chatBoxes.push(chatBox);
            self.chatContainer.append(chatBox.Get$());
            chatBox.Maximize();
        }
        
        
        // update chat list 
        var presence = $('li#'+username).data('presence');
        if(presence == 'unavailable') {
            chatBox.Warning('show', 'Użytkownik <strong>'+chatBox.username+'</strong> nie jest dostępny.<br/>Te wiadomości dotrą do niego dopiero gdy będzie zalogowany.');
        }
        else {
            chatBox.Warning('hide');
        }
    }
    
    ChatList.prototype.SetUserCredentials = function (userCredentials) {
        this.userCredentials = userCredentials;
    }
    
    ChatList.prototype.ClearUserList = function() {
        
        var self = this;
        self.chatListUserList.children().each(function() {
            $(this).remove();
        });
    }
    
    ChatList.prototype.OnUsersFetched = function(users) {
    
        var self = this;

        self.users = $(users).sort(function(a,b) {
                                        return a.username.toLowerCase() > b.username.toLowerCase() ? 1 : -1;  
                                    });
                    
        //self.chatListUsersList.clear();
        
        self.users.each(function () {
        
            var user = this;
            if(user.username != self.userCredentials.username) {
                
                self.chatListUserList.append(
                    $('<li>')
                        .attr({'id' : user.username})
                        .data('userCredentials', {'username':user.username, 'jid':user.username+'@'+App.options.domain})
                        .data('presence', 'unavailable')
                        .css({'height':'24px'})
                        .addClass('chat-list-userlist-element ui-corner-all')
                        .append($('<div>').attr({'id':'icon'}).addClass('chat-list-user-notactive'))
                        .append($('<div>').addClass('chat-list-userlist-text').text(user.username))
                        .bind('click', function() {
                            $(this).addClass('chat-list-userlist-element-selected');
                            self.selectedUsers.push($(this).data('userCredentials'));
                        })
                        .bind('dblclick', function () {
                            self.ShowChatBox(user.username+'@'+App.options.domain, user.username);
                        })
                        .bind('contextmenu', function (e) {
                            self.contextMenu
                                .css({
                                    left : e.pageX,
                                    top : e.pageY,
                                    zIndex : '101'
                                })
                                .show();
                            
                            self.contextMenu.data('selectedUser', $(this).data('userCredentials'));
                            
                            return false;
                        })
                );
                
                App.xmppConnection.send($pres({'to':user.username+'@'+App.options.domain, type: 'subscribe'}));
            }
        });
    }
    
    ChatList.prototype.OnMessage = function (jid, username, text) {

        var self = this;
    
        var chatBoxFound = false;
        for(var i=0; i<self.chatBoxes.length; i++) {
            var chatBox = self.chatBoxes[i];
            if(chatBox.jid == jid) {
                chatBoxFound = true;
                chatBox.UpdateChat(jid, username, text);
                chatBox.Get$().show();
                chatBox.Maximize();
                break;
            }
        }
        
        if(!chatBoxFound) {
            var chatBox = new ChatBox(self, jid, username);
            self.chatBoxes.push(chatBox);
            self.chatContainer.append(chatBox.Get$());
            chatBox.UpdateChat(jid, username, text);
            chatBox.Maximize();
        }
    }
    
    ChatList.prototype.OnPresence = function (jid, username, type) {
        
        var self = this;
        
        // update chat list 
        var userElement = $('li#'+username);
        var icon = userElement.find('div#icon');
        if(type == 'unavailable') {
            userElement.data('presence', 'unavailable');
            icon.addClass('chat-list-user-notactive');
            icon.removeClass('chat-list-user-active');
        }
        else {
            userElement.data('presence', 'available');
            icon.addClass('chat-list-user-active');
            icon.removeClass('chat-list-user-notactive');
        }
        
        //update existing chat box
        for(var i=0; i<self.chatBoxes.length; i++) {
            var chatBox = self.chatBoxes[i];
            if(chatBox.jid == jid) {
                if(type == 'unavailable') {
                    chatBox.Warning('show', 'Użytkownik <strong>'+chatBox.username+'</strong> nie jest dostępny.<br/>Te wiadomości dotrą do niego dopiero gdy będzie zalogowany.');
                }
                else {
                    chatBox.Warning('hide');
                }
                break;
            }
        }
    }
    
    ChatList.prototype.OnConnectionStateChanged = function(connectionStatus) {
        
        var self = this;
        
        switch(connectionStatus) {
    
            case App.ConnectionStatus.INPROGRESS:
                self.chatListHeaderText.html('Logowanie...');
                self.userLoginIcon.addClass('chat-list-user-notactive');
                self.userLoginIcon.removeClass('chat-list-user-active');
                break;
                
            case App.ConnectionStatus.UNAVAILABLE:
                self.chatListHeaderText.html('Niedostępny');
                self.userLoginIcon.addClass('chat-list-user-notactive');
                self.userLoginIcon.removeClass('chat-list-user-active');
                
                self.ClearUserList();
        
                // hide all chat boxes
                for(var i=0; i<self.chatBoxes.length; i++) {
                    var chatBox = self.chatBoxes[i];
                    chatBox.Minimize();
                    chatBox.Get$().hide();
                }
                
                break;
                
            case App.ConnectionStatus.AVAILABLE:
                self.chatListHeaderText.html('Zalogowany <strong>'+self.userCredentials.username+'</strong>');
                self.userLoginIcon.removeClass('chat-list-user-notactive');
                self.userLoginIcon.addClass('chat-list-user-active')
                
                // adding users to gui list
                $.ajax({
                    dataType : "json",
                    url : 'data.php',
                    data : {'contacts' : self.userCredentials.username},
                    success : function(users) {
                        self.OnUsersFetched(users);
                    }
                });
                
                break;
        }
    }
    
    /*
     * Chat Box
     */ 
    var ChatBox = function(controller, jid, username) {
            
        var self = this;
        
        /*
         * class fields
         */
        self.chatController = controller;
                
        self.jid = jid;
        self.username = username;
        self.isMinimized = false;
        self.chatBox = $('<div>').addClass('chat-box');
        self.chatBoxHeader = $('<div>')
                                .addClass('chat-box-header')
                                .dblclick(function() {
                                    if(self.isMinimized)
                                        self.Maximize();
                                    else
                                        self.Minimize();
                                });
        self.chatBoxMain = $('<div>').addClass('chat-box-main');
        self.chatBoxFooter = $('<div>').addClass('chat-box-footer');
        
        self.chatBox.append(self.chatBoxHeader);
        self.chatBox.append(self.chatBoxMain);
        self.chatBox.append(self.chatBoxFooter);
        
        self.chatBoxHeader.append(
                            $('<div>')
                                .addClass('chat-box-header-text')
                                .html('<strong>'+self.username+'</strong>')
                            );

        self.chatBoxTextArea = $('<div>')
                                    .addClass('chat-box-textarea');
        self.chatBoxMain.append(self.chatBoxTextArea);                 

        self.chatBoxWarning = $('<div>').addClass('chat-box-warning').hide();
        self.chatBoxWarningText = $('<div>').addClass('chat-box-warning-text');
        self.chatBoxWarning.append(self.chatBoxWarningText)
        self.chatBoxMain.append(self.chatBoxWarning);          
        
        self.chatBoxInput = $('<input>')
                                .addClass('chat-box-input')
                                .attr({
                                    'type' : 'text'
                                })
                                .bind('keypress', function (e) {
                                    var code = (e.keyCode ? e.keyCode : e.which);
                                    var value = self.chatBoxInput.val();
                                    if (code == 13 && value != '') { 
                                        e.stopPropagation();
                                        self.Send(value);
                                    }
                                });
        self.chatBoxFooter.append(self.chatBoxInput);
        
        var sendButton = $('<div>')
                                .addClass('chat-box-icon ui-corner-all chat-box-sendbutton')
                                .append($('<span>').addClass('ui-icon ui-icon-comment'))
                                .attr({'title': 'Wyślij'})
                                .click(function(){
                                    var value = self.chatBoxInput.val();
                                    if (value != '') { 
                                        self.Send(value);
                                    }
                                });
        self.chatBoxFooter.append(sendButton);
        

                            
        var headerIcons = $('<div>').addClass('chat-box-header-icons');

        // minimize box
        self.minimizeBox = $('<div>')
                                .addClass('chat-box-icon ui-corner-all')
                                .append($('<span>').addClass('ui-icon ui-icon-triangle-1-s'))
                                .attr({'title': 'Minimalizuj'})
                                .click(function(){
                                    self.Minimize();
                                });
        headerIcons.append(self.minimizeBox);

        // maximize box
        self.maximizeBox = $('<div>')
                                .addClass('chat-box-icon ui-corner-all')
                                .append($('<span>').addClass('ui-icon ui-icon-triangle-1-n'))
                                .attr({'title': 'Pokaż czat'})
                                .hide()
                                .click(function(){
                                    self.Maximize();
                                });
        headerIcons.append(self.maximizeBox);
        
        // close box
        self.closeBox = $('<div>')
                                .addClass('chat-box-icon ui-corner-all')
                                .append($('<span>').addClass('ui-icon ui-icon-closethick'))
                                .attr({'title': 'Zamknij czat'})
                                .click(function(){
                                    self.Destroy();
                                });
        headerIcons.append(self.closeBox);
        
        self.chatBoxHeader.append(headerIcons)
        
        //TODO: presence
        // $.ajax({
            // url : 'presence/status',
            // data : {'jid' : self.jid, 'type': 'text'},
            // success : function(status) {
                // alert(status);
                // if(status == 'null')
                    // self.Warning('show', 'Użytkownik '+self.username+' nie otrzyma tych wiadomości natychmiast ponieważ nie jest zalogowany.');
                // else
                    // self.Warning('hide');
            // }
        // });

        self.chatBoxInput.focus();
    };
    
    ChatBox.prototype.Get$ = function () {
    	return this.chatBox;
    }
    
    ChatBox.prototype.Minimize = function () {
    	
    	var self = this;
    	self.maximizeBox.show();
    	self.minimizeBox.hide();
    	self.chatBoxFooter.hide();
    	self.chatBoxMain.hide();
    	self.chatBox.removeClass('chat-box-maximized');
    	self.chatBox.addClass('chat-box-minimized');
        
        self.isMinimized = true;
    }
    ChatBox.prototype.Maximize = function () {
    	
    	var self = this;
    	self.maximizeBox.hide();
    	self.minimizeBox.show();
    	self.chatBoxFooter.show();
    	self.chatBoxMain.show();
    	self.chatBox.removeClass('chat-box-minimized');
    	self.chatBox.addClass('chat-box-maximized');
        
        self.chatBoxInput.focus();
        
        self.isMinimized = false;
    }
    
    ChatBox.prototype.Destroy = function () {
    	
    	var self = this;
        
    	// self.maximizeBox.hide();
    	// self.minimizeBox.hide();
    	// self.chatBoxFooter.hide();
    	// self.chatBoxMain.hide();
    	self.chatBox.hide();
        
        // delete self.isMinimized;
        // delete self.chatBox;
        // delete self.chatBoxMain;
        // delete self.chatBoxFooter;
        // delete self.chatBoxHeader;
        // delete self.chatBoxInput;
        // delete self.minimizeBox;
        // delete self.maximizeBox;
        // delete self.closeBox;
        // delete self.chatBox;
        // delete self;
    }
    
    ChatBox.prototype.Warning = function (action, text) {
        
        var self = this;
        
        if(action == 'show') {
            self.chatBoxTextArea.addClass('chat-box-textarea-warning');
            self.chatBoxTextArea.removeClass('chat-box-textarea');
            self.chatBoxWarningText.html(text);
            self.chatBoxWarning.show();
        }
        else if(action == 'hide') {
            self.chatBoxTextArea.addClass('chat-box-textarea');
            self.chatBoxTextArea.removeClass('chat-box-textarea-warning');
            self.chatBoxWarning.hide();        
        }
        else {
        
        }
        
        self.chatBoxTextArea.scrollTop(
                        self.chatBoxTextArea[0].scrollHeight
                        - self.chatBoxTextArea.height()
                     );
    }
    
    ChatBox.prototype.Send = function (value) {
    	
        var self = this;
    	
        App.SendMessage(self.jid, value);
    	
    	var header = '';
    	if (self.lastWriter != self.chatController.userCredentials.jid) {
    		var now = new Date();
    		var hours = now.getHours();
    		var minutes = now.getMinutes();
    		if (minutes < 10)
    			minutes = "0" + minutes;
    		var seconds = now.getSeconds();
    		if (seconds < 10)
    			seconds = "0" + seconds;
    		
    		header = "<span style='color: gray; font-size: 90%; float: right;'>" 
                    + hours + ':' + minutes + ':' + seconds + '</span> '
                    + "<span style='color: gray; font-size: 90%;'>" + self.chatController.userCredentials.username + '</span>'
    			
    	}
    	self.chatBoxTextArea.append(
                                header 
                                + "<div style='padding-left: 10px; padding-bottom: 3px;'>"
                                + value 
                                + '</div>'
                            );
    	self.chatBoxTextArea.scrollTop(
                                self.chatBoxTextArea[0].scrollHeight
                                - self.chatBoxTextArea.height()
                             );
    	
    	self.lastWriter = self.chatController.userCredentials.jid;
    	
    	self.chatBoxInput.val('');
    	self.chatBoxInput.focus();
    }

    ChatBox.prototype.UpdateChat = function (jid, username, text) {
    	
        var self = this;
    
    	var header = '';
    	if (self.lastWriter != jid) {
    		var now = new Date();
    		var hours = now.getHours();
    		var minutes = now.getMinutes();
    		if (minutes < 10)
    			minutes = "0" + minutes;
    		var seconds = now.getSeconds();
    		if (seconds < 10)
    			seconds = "0" + seconds;
    		
    		header = "<span style='color: gray; font-size: 90%; float: right;'>" 
                    + hours + ':' + minutes + ':' + seconds + '</span> '
                    + "<span style='color: gray; font-size: 90%;'>" + username + '</span>'
    			
    	}
    	self.chatBoxTextArea.append(
                                header 
                                + "<div style='padding-left: 10px; padding-bottom: 3px;'>"
                                + text 
                                + '</div>'
                            );
    	self.chatBoxTextArea.scrollTop(
                                self.chatBoxTextArea[0].scrollHeight
                                - self.chatBoxTextArea.height()
                             );
    	
    	self.lastWriter = jid;
     
    }    
    
    $.fn.chat = function (method, options) {
        
        App.options = $.extend(App.options, options);
        
        /***** Method resolving *****/
        if (App[method]) {
            return App[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return App.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist in jQuery.chat');
        }
    };

})(jQuery);
