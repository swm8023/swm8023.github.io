// 在标签页处于非激活状态时停止绘图
requestAnimFrame = window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    function(callback) {setTimeout(callback, 1000/60);};

$(document).ready(function() {
    webGLStart();
}); 

// 角度转化为弧度
var degToRad = function(deg) {
    return deg * Math.PI / 180;
}

// 初始化GL
var initGL = function(canvas) {
    // 从canvas重获得WebGL句柄
    try {
        gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {}
    if (!gl) {
        alert("Init OpenGL failed");
    }
    return gl;
}

// 载入纹理
var loadShaders = function(gl, shaders) {
    // 载入shaders
    var prog = gl.createProgram();
    for (var i = 0; i < shaders.length; i++) {
        var shaderScript = $("#" + shaders[i]);
        var shader;
        if (shaderScript[0].type == "x-shader/x-fragment") {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else if (shaderScript[0].type == "x-shader/x-vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            alert("shader id error");
            return null;
        }
        var str = shaderScript.text();
        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert(gl.getShaderInfoLog(shader));
            return null;
        }

        console.log(shaders[i] + " compile success");
        gl.attachShader(prog, shader);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        alert(gl.getProgramInfoLog(prog));
        return null;
    }
    console.log("link success");
    return prog;
}



// GL对象基类
var glObject = function(gl) {
    this.gl = gl;
    this.loadComp = false;
    // 载入资源,将参数缓存到内存中,在init中调用,不需要缓存的对象传null
    this.loadResources = function(vertices, vitem, normals, nitem, coords, citem, indexes, iitem, texPath) {
        var gl = this.gl;
        // 顶点缓存
        if (vertices != null) {
            this.vboPos = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vboPos);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
            this.vboPosUnit  = vitem;
            this.vboPosNum = parseInt(vertices.length / vitem);
        }
        // 顶点法向量缓存
        if (normals != null) {
            this.vboNormal = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vboNormal);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
            this.vboNormalUnit  = nitem;
            this.vboNormalNum = parseInt(normals.length / nitem);
        }
        // 纹理缓存
        if (coords != null) {
            this.vboCoord = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vboCoord);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW);
            this.vboCoordUnit  = citem;
            this.vboCoordNum = parseInt(coords.length / citem);
        }
        // 索引缓存
        if (indexes != null) {
            this.vboIndex = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.vboIndex);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexes), gl.STATIC_DRAW);
            this.vboIndexUnit  = iitem;
            this.vboIndexNum = parseInt(indexes.length / iitem);
        }
        // 创建纹理
        if (texPath != null) {
            this.tex = gl.createTexture();
            this.tex.img = new Image();

            this.loadComp = false;
            var self = this; // 注意这里onload中的this指的是img,所以在这里记录this对象
            this.tex.img.onload = function() {
                console.log(this);
                gl.bindTexture(gl.TEXTURE_2D, self.tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, self.tex.img);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.bindTexture(gl.TEXTURE_2D, null);
                // load完图像资源后标记完成
                self.loadComp = true;
            }
            // 触发资源文件的加载
            this.tex.img.src = texPath;
        } else {
            // 没有资源文件,直接标记加载完成
            this.loadComp = true;
        }
    };

    // 做一些画前准备,主要就是加载对应资源给着色器
    this.prepareDraw = function(indexPos, indexNormal, indexCoord, indexTex) {
        var gl = this.gl;
        // 加载顶点缓存
        if (typeof(this.vboPos) != "undefined" && indexPos != null) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vboPos);
            gl.vertexAttribPointer(indexPos, this.vboPosUnit, gl.FLOAT, false, 0, 0);
        }
        // 加载顶点法向量缓存
        if (typeof(this.vboNormal) != "undefined" && indexNormal != null) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vboNormal);
            gl.vertexAttribPointer(indexNormal, this.vboNormalUnit, gl.FLOAT, false, 0, 0);
        }
        // 加载纹理坐标缓存
        if (typeof(this.vboCoord) != "undefined" && indexCoord != null) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vboCoord);
            gl.vertexAttribPointer(indexCoord, this.vboCoordUnit, gl.FLOAT, false, 0, 0);
        }
        // 加载纹理
        if (typeof(this.tex) != "undefined" && indexTex != null) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.tex);
            gl.uniform1i(indexTex, 0);
        }
    };

    // 从索引画
    this.drawElements = function() {
        var gl = this.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.vboIndex);
        gl.drawElements(gl.TRIANGLES, this.vboIndexNum, gl.UNSIGNED_SHORT, 0);
    }

    // 从点点画
    this.drawArray = function(ptype) {
        var gl = this.gl;
        gl.bindBUffer(gl.ARRAY_BUFFER, this.vboPos);
        gl.drawArray(ptype, this.vboPosNum, gl.UNSIGNED_SHORT, 0);
    }
};