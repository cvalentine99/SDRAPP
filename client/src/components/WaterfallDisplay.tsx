import { useEffect, useRef, useState } from "react";
import { useGPUMetrics } from "@/contexts/GPUMetricsContext";

interface WaterfallDisplayProps {
  width?: number;
  height?: number;
  fftSize?: number;
}

// Simulation constants
const NOISE_FLOOR = 30;
const SIGNAL_1_FREQ = 0.3;
const SIGNAL_1_WIDTH = 0.02;
const SIGNAL_1_POWER = 150;
const SIGNAL_2_FREQ = 0.6;
const SIGNAL_2_WIDTH = 0.01;
const SIGNAL_2_POWER = 200;
const SIGNAL_3_FREQ = 0.75;
const SIGNAL_3_WIDTH = 0.015;
const SIGNAL_3_POWER = 100;
const MAX_FFT_VALUE = 255;

export function WaterfallDisplay({
  width = 1024,
  height = 512,
  fftSize = 1024,
}: WaterfallDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const { updateMetrics } = useGPUMetrics();
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const textureCountRef = useRef(0);
  const bufferCountRef = useRef(0);

  // Initialize WebGL context and shaders
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    }) as WebGLRenderingContext | null;

    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    // gl context stored in closure

    // Vertex shader for full-screen quad with circular scrolling
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      uniform float u_yOffset;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        // Apply circular Y-offset for scrolling effect
        v_texCoord = vec2(a_texCoord.x, mod(a_texCoord.y + u_yOffset, 1.0));
      }
    `;

    // Fragment shader with color mapping for power density
    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      
      // Cyberpunk color mapping: black -> cyan -> pink -> white
      vec3 colorMap(float value) {
        if (value < 0.25) {
          // Black to dark cyan
          return mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.5, 0.5), value * 4.0);
        } else if (value < 0.5) {
          // Dark cyan to bright cyan
          return mix(vec3(0.0, 0.5, 0.5), vec3(0.0, 1.0, 1.0), (value - 0.25) * 4.0);
        } else if (value < 0.75) {
          // Bright cyan to pink
          return mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 0.0, 0.8), (value - 0.5) * 4.0);
        } else {
          // Pink to white (hot signals)
          return mix(vec3(1.0, 0.0, 0.8), vec3(1.0, 1.0, 1.0), (value - 0.75) * 4.0);
        }
      }
      
      void main() {
        float intensity = texture2D(u_texture, v_texCoord).r;
        vec3 color = colorMap(intensity);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("Vertex shader error:", gl.getShaderInfoLog(vertexShader));
      return;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error(
        "Fragment shader error:",
        gl.getShaderInfoLog(fragmentShader)
      );
      return;
    }

    // Link program
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    // program stored in closure
    gl.useProgram(program);

    // Create full-screen quad
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);

    const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

    // Position buffer
    const positionBuffer = gl.createBuffer();
    bufferCountRef.current++;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Texture coordinate buffer
    const texCoordBuffer = gl.createBuffer();
    bufferCountRef.current++;
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Create circular buffer texture
    const texture = gl.createTexture();
    textureCountRef.current++;
    // texture stored in closure
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set texture parameters for circular scrolling
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); // Circular Y-axis
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Initialize texture with empty data
    const textureData = new Uint8Array(fftSize * height);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      fftSize,
      height,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      textureData
    );

    // Simulate incoming FFT data for demo
    let currentRow = 0;
    const simulateData = () => {
      if (!gl || !texture) return;

      // Generate simulated FFT data (replace with real WebSocket data)
      const fftData = new Uint8Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        // Simulate some peaks and noise
        const freq = i / fftSize;
        let value = Math.random() * NOISE_FLOOR;

        // Add some simulated signals
        if (Math.abs(freq - SIGNAL_1_FREQ) < SIGNAL_1_WIDTH) value += SIGNAL_1_POWER;
        if (Math.abs(freq - SIGNAL_2_FREQ) < SIGNAL_2_WIDTH) value += SIGNAL_2_POWER;
        if (Math.abs(freq - SIGNAL_3_FREQ) < SIGNAL_3_WIDTH) value += SIGNAL_3_POWER;

        fftData[i] = Math.min(MAX_FFT_VALUE, value);
      }

      // Update one row of the texture (circular buffer technique)
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        currentRow,
        fftSize,
        1,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        fftData
      );

      // Update Y-offset for scrolling
      currentRow = (currentRow + 1) % height;
    };

    // Render loop
    const render = () => {
      if (!gl || !program) return;

      // Update with new data (60 FPS)
      simulateData();

      // Set uniform for Y-offset
      const yOffsetLocation = gl.getUniformLocation(program, "u_yOffset");
      gl.uniform1f(yOffsetLocation, currentRow / height);

      // Render
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Track FPS and update GPU metrics
      frameCountRef.current++;
      const now = Date.now();
      const elapsed = now - lastFpsUpdateRef.current;
      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        
        // Get WebGL memory info if available
        const memoryInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        let memoryUsed = 0;
        let memoryTotal = 0;
        
        if (memoryInfo) {
          // Estimate based on texture and buffer sizes
          const textureMemory = width * height * 4; // RGBA bytes
          memoryUsed = (textureMemory / (1024 * 1024)); // Convert to MB
          memoryTotal = 256; // Typical GPU memory estimate
        }
        
        updateMetrics({
          fps,
          memoryUsed,
          memoryTotal,
          textureCount: textureCountRef.current,
          bufferCount: bufferCountRef.current,
          drawCalls: frameCountRef.current,
        });
        
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (gl) {
        gl.deleteProgram(program);
        gl.deleteTexture(texture);
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(texCoordBuffer);
      }
    };
  }, [fftSize, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
