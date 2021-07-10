export class Program {
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    attrib;
    uniform;
    defines;
    firstUse: boolean;
    nextUseCallbacks: any[];
    vertShader: WebGLShader;
    fragShader: WebGLShader;

    constructor(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string, attribMap, defines) {
        this.gl = gl;
        this.program = gl.createProgram();
        this.attrib = null;
        this.uniform = null;
        this.defines = {};

        this.firstUse = true;
        this.nextUseCallbacks = [];

        let definesString = '';
        if (defines) {
            for (const define in defines) {
                if (define) {
                    this.defines[define] = defines[define];
                    definesString += `#define ${define} ${defines[define]}\n`;
                }
            }
        }

        this.vertShader = gl.createShader(gl.VERTEX_SHADER);
        gl.attachShader(this.program, this.vertShader);
        gl.shaderSource(this.vertShader, definesString + vertSrc);
        gl.compileShader(this.vertShader);

        this.fragShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.attachShader(this.program, this.fragShader);
        gl.shaderSource(this.fragShader, definesString + fragSrc);
        gl.compileShader(this.fragShader);

        if (attribMap) {
            this.attrib = {};
            for (const attribName in attribMap) {
                if (attribName) {
                    gl.bindAttribLocation(this.program, attribMap[attribName], attribName);
                    this.attrib[attribName] = attribMap[attribName];
                }
            }
        }

        gl.linkProgram(this.program);
    }

    onNextUse(callback) {
        this.nextUseCallbacks.push(callback);
    }

    use() {
        const gl = this.gl;

        // If this is the first time the program has been used do all the error checking and
        // attrib/uniform querying needed.
        if (this.firstUse) {
            this.firstUse = false;
            if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
                if (!gl.getShaderParameter(this.vertShader, gl.COMPILE_STATUS)) {
                    console.error('Vertex shader compile error: ' + gl.getShaderInfoLog(this.vertShader));
                } else if (!gl.getShaderParameter(this.fragShader, gl.COMPILE_STATUS)) {
                    console.error('Fragment shader compile error: ' + gl.getShaderInfoLog(this.fragShader));
                } else {
                    console.error('Program link error: ' + gl.getProgramInfoLog(this.program));
                }
                gl.deleteProgram(this.program);
                this.program = null;
            } else {
                if (!this.attrib) {
                    this.attrib = {};
                    const attribCount = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
                    for (let i = 0; i < attribCount; i++) {
                        const attribInfo = gl.getActiveAttrib(this.program, i);
                        this.attrib[attribInfo.name] = gl.getAttribLocation(this.program, attribInfo.name);
                    }
                }

                this.uniform = {};
                const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
                let uniformName = '';
                for (let i = 0; i < uniformCount; i++) {
                    const uniformInfo = gl.getActiveUniform(this.program, i);
                    uniformName = uniformInfo.name.replace('[0]', '');
                    this.uniform[uniformName] = gl.getUniformLocation(this.program, uniformName);
                }
            }
            gl.deleteShader(this.vertShader);
            gl.deleteShader(this.fragShader);
        }

        gl.useProgram(this.program);

        if (this.nextUseCallbacks.length) {
            for (const callback of this.nextUseCallbacks) {
                callback(this);
            }
            this.nextUseCallbacks = [];
        }
    }
}
