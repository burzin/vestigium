(function(){
    var xhr = XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
    xhr.open('post', '/tms/{{{env}}}/ver', true);
    xhr.onreadystatechange = function(){
        if(xhr.readyState === 4){
            var version = JSON.parse(this.responseText).version,
                s = document.createElement('script');
            s.src = '/tms/{{{env}}}/' + version + '/main.js';
            document.head.appendChild(s);
        }
    };
    xhr.send();
}());