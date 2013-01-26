/*
 * @Description: It is XMPP chat plugin for jQuery. Using Strophe.
 * @Author: Michal Lapacz
 * @Date: 21.01.2013
 */
(function ($) {
    var App = {
        ConnectionStatus: {
            OK: 0,
            INPROGRESS: 1,
            FAIL: 2
        },
        options: {
            bosh_service : "http-bind/"
        },
        chatList: null,
        xmppConnection : null,
        //onConnected: null,
        //onRoomsFetched: null,
        //onUsersFetched: null,
        //onConnectionStateChanged: null,
        
        init : function(options) {
        
            //App.options = $.extend(App.defaultOptions, options);
            
            // Strophe.log = function (level, msg) {
              // App.log('['+level+']: '+msg);
            // }
                                
            var container = this;
            container.addClass('chat-container');
            
            App.chatList = new ChatList(container);
            container.append(App.chatList.Get$());
            
            //App.onConected = App.chatList.OnConnected;
            //App.onRoomsFetched = App.chatList.OnRoomsFetched;
            //App.onUsersFetched = App.chatList.OnUsersFetched;
            //App.onConnectionStateChanged = App.chatList.OnConnectionStateChanged;
            
            App.chatList.Minimize();
            
            //App.FetchUserCredentialsAndLogin();
        },
        log : function (msg) {
            $('#log').append('<div></div>').append(document.createTextNode(msg));
        },
        rawInput : function (data) {
            App.log('RECV: ' + data);
        },
        rawOutput : function (data) {
            App.log('SENT: ' + data);
        },
        FetchUserCredentialsAndLogin : function () {
            
            $.ajax({
                dataType : "json",
                url : 'data.php',
                data : {'username': App.options.username},
                success : function (userCredentials) {
                    App.Login(userCredentials);
                }
            });
        },
        Login : function (userCredentials) {
            
            // adding rooms to gui list
            // $.ajax({
                // dataType : "json",
                // url : 'data.php',
                // data : {'all':'rooms'},
                // success : function(rooms) {
                    // //if(App.onRoomsFetched != null)
                        // App.chatList.OnRoomsFetched(rooms);
                // }
            // });
            
            // adding users to gui list
            $.ajax({
                dataType : "json",
                url : 'data.php',
                data : {'all':'users'},
                success : function(users) {
                    //if(App.onUsersFetched != null)
                        App.chatList.OnUsersFetched(users);
                }
            });
            
            App.chatList.SetUserCredentials(userCredentials);
            
            App.xmppConnection = new Strophe.Connection(App.options.bosh_service);
            //App.xmppConnection.rawInput = App.rawInput;
            //App.xmppConnection.rawOutput = App.rawOutput;
            App.xmppConnection.connect(
                userCredentials.jid,
                userCredentials.password,
                App.OnConnect
            );
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
                    App.chatList.OnConnectionStateChanged(App.ConnectionStatus.FAIL);
                    break;
                    
                case Strophe.Status.CONNECTED:
                    App.chatList.OnConnectionStateChanged(App.ConnectionStatus.OK);
                    App.xmppConnection.addHandler(App.OnMessage, null, 'message', null, null,  null); 
                    App.xmppConnection.send($pres().tree());
                    break;
                    
                case Strophe.Status.ATTACHED:
                    App.chatList.OnConnectionStateChanged(App.ConnectionStatus.OK); //????? moze osobny order code
                    break;
                    
                default:
                    App.chatList.OnConnectionStateChanged(App.ConnectionStatus.FAIL);
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
                                Strophe.getText(body)
                              );
                
                //var reply = $msg({to: from, from: to, type: 'chat'})
                //        .cnode(Strophe.copyElement(body));
                //App.connection.send(reply.tree());

                //App.log('ECHOBOT: I sent ' + from + ': ' + Strophe.getText(body));
            }

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
                    //alert(self.jid);
                    var reply = $msg({
                            to : jid, //Strophe.getDomainFromJid(jid),
                            from : App.xmppConnection.jid,
                            type : "chat"
                        }).c("body").t(msg);
                    
                    App.xmppConnection.send(reply.tree());
                    App.log(msg, "from");
                    
                    //$('#' + elemid).get(0).value = "";
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
        self.xmppConnection = null;
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
                                    //.html('Połączony <strong>'+self.jid+'</strong>')
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
        
        self.chatListHeader.append(headerIcons)
        
        // self.chatListRoomList = $('<ol>').selectable();
        // self.chatListMain.append(self.chatListRoomList);
        
        // self.chatListMain.append($('<hr>').css({'width':'90%'}));
        
        self.chatListUserList = $('<ol>').addClass('chat-list-userlist');//.selectable();
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
    
    ChatList.prototype.ShowChatBox = function (id, username) {
        
        var self = this;
        
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
    }
    
    ChatList.prototype.SetUserCredentials = function (userCredentials) {
        this.userCredentials = userCredentials;
    }
    
    // ChatList.prototype.OnRoomsFetched = function (rooms) {

        // var self = this;
        
        // self.rooms = $(rooms).sort(function(a,b) {
                                        // return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;  
                                    // });
        
        // //self.chatListRoomList.clear();
        
        // self.rooms.each(function() {
            // var room = this;
            // self.chatListRoomList.append(
                // $('<button>')
                    // .addClass('chat-list-userlist-element ui-corner-all')
                    // .append($('<div>').addClass('chat-list-userlist-text').text(room.name))
                    // .click(function () {
                        // self.ShowChatBox(room.name, '');
                    // }) 
            // );
        // });
    // }
    
    ChatList.prototype.OnUsersFetched = function(users) {
    
        var self = this;
        //alert(self.chatListUserList)
        self.users = $(users).sort(function(a,b) {
                                        return a.username.toLowerCase() > b.username.toLowerCase() ? 1 : -1;  
                                    });
                    
        //self.chatListUsersList.clear();
        
        self.users.each(function () {
            var user = this;
            if(user.jid != self.userCredentials.jid) {
                self.chatListUserList.append(
                    $('<li>')
                        .data('userCredentials', {'username':user.username, 'jid':user.jid})
                        .css({'height':'24px'})
                        .addClass('chat-list-userlist-element ui-corner-all')
                        .append($('<div>').addClass('chat-list-user-notactive'))
                        .append($('<div>').addClass('chat-list-userlist-text').text(user.username + ' [' + user.jid + ']'))
                        .bind('click', function() {
                            $(this).addClass('chat-list-userlist-element-selected');
                            self.selectedUsers.push($(this).data('userCredentials'));
                        })
                        .bind('dblclick', function () {
                            self.ShowChatBox(user.jid, user.username);
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
            }
        });
    }
    
    ChatList.prototype.OnMessage = function (jid, text) {

        var self = this;
    
        var chatBoxFound = false;
        for(var i=0; i<self.chatBoxes.length; i++) {
            var chatBox = self.chatBoxes[i];
            if(chatBox.jid == jid) {
                chatBoxFound = true;
                chatBox.UpdateChat(jid, text);
                chatBox.Get$().show();
                chatBox.Maximize();
                break;
            }
        }
        
        if(!chatBoxFound) {
            var chatBox = new ChatBox(self, jid, ''); //TODO: search users and find username
            self.chatBoxes.push(chatBox);
            self.chatContainer.append(chatBox.Get$());
            chatBox.UpdateChat(jid, text);
            chatBox.Maximize();
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
                
            case App.ConnectionStatus.FAIL:
                self.chatListHeaderText.html('Niezalogowany');
                self.userLoginIcon.addClass('chat-list-user-notactive');
                self.userLoginIcon.removeClass('chat-list-user-active');
                break;
                
            case App.ConnectionStatus.OK:
                self.chatListHeaderText.html('Zalogowany <strong>'+self.userCredentials.jid+'</strong>');
                self.userLoginIcon.removeClass('chat-list-user-notactive');
                self.userLoginIcon.addClass('chat-list-user-active')
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
                                .html('<strong>'+self.jid+'</strong>')
                            );

        self.chatBoxTextArea = $('<div>')
                                    .addClass('chat-box-textarea');
        self.chatBoxMain.append(self.chatBoxTextArea);                 
                            
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
                    + "<span style='color: gray; font-size: 90%;'>" + self.chatController.userCredentials.jid + '</span>'
    			
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

    ChatBox.prototype.UpdateChat = function (jid, text) {
    	
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
                    + "<span style='color: gray; font-size: 90%;'>" + jid + '</span>'
    			
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