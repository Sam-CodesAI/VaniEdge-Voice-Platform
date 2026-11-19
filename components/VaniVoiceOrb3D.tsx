"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Mic, Volume2, Phone, Brain, Sparkles, Activity } from "lucide-react";

interface VaniVoiceOrb3DProps {
  isSpeaking: boolean;
  isListening: boolean;
  isCalling: boolean;
  isThinking?: boolean;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseRadius: number;
  phi: number;
  theta: number;
}

export default function VaniVoiceOrb3D({
  isSpeaking,
  isListening,
  isCalling,
  isThinking = false,
}: VaniVoiceOrb3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  // Track cursor movement for interactive 3D parallax rotation
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mouseRef.current.targetX = nx * 0.8;
    mouseRef.current.targetY = ny * 0.8;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
  }, []);

  // 60FPS 3D Particle Mesh Sphere with Spherical Harmonics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    // Generate 320 Fibonacci distributed 3D surface points
    const POINT_COUNT = 320;
    const points: Point3D[] = [];
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < POINT_COUNT; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / POINT_COUNT);
      const baseR = 72; // Sphere base radius

      const x = baseR * Math.sin(phi) * Math.cos(theta);
      const y = baseR * Math.cos(phi);
      const z = baseR * Math.sin(phi) * Math.sin(theta);

      points.push({ x, y, z, baseRadius: baseR, phi, theta });
    }

    let rotX = 0;
    let rotY = 0;

    const render = () => {
      time += 0.035;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      // Base auto rotation + mouse offset
      rotY += 0.012 + mouseRef.current.x * 0.03;
      rotX = Math.sin(time * 0.4) * 0.2 + mouseRef.current.y * 0.6;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Color scheme based on state
      let r = 16, g = 185, b = 129; // Emerald default
      let waveMultiplier = 1.0;
      let waveSpeed = 1.0;

      if (isSpeaking) {
        r = 16; g = 185; b = 129; // Vivid Emerald
        waveMultiplier = 2.8;
        waveSpeed = 2.4;
      } else if (isListening) {
        r = 6; g = 182; b = 212; // Cyan Photon
        waveMultiplier = 2.2;
        waveSpeed = 3.0;
      } else if (isThinking) {
        r = 245; g = 158; b = 11; // Amber Solar
        waveMultiplier = 1.6;
        waveSpeed = 4.0;
      } else if (isCalling) {
        r = 99; g = 102; b = 241; // Indigo Telephony
        waveMultiplier = 1.3;
        waveSpeed = 1.2;
      }

      // Draw outer ambient ring for "Thinking" state (Orbital Satellite Ring)
      if (isThinking) {
        const ringRadius = 88;
        const orbitAngle = time * 3;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.2) {
          const rx = ringRadius * Math.cos(a + orbitAngle);
          const ry = ringRadius * Math.sin(a + orbitAngle) * 0.35;
          if (a === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(245, 158, 11, 0.4)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Satellite particle
        const satX = ringRadius * Math.cos(orbitAngle * 1.5);
        const satY = ringRadius * Math.sin(orbitAngle * 1.5) * 0.35;
        ctx.beginPath();
        ctx.arc(satX, satY, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }

      // Project, displace, and sort 3D points
      interface ProjectedPoint {
        px: number;
        py: number;
        pz: number;
        size: number;
        alpha: number;
      }

      const projected: ProjectedPoint[] = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];

        // Acoustic harmonic radial displacement
        const harmonic =
          Math.sin(p.phi * 4 + time * waveSpeed) *
          Math.cos(p.theta * 3 - time * waveSpeed * 0.8) *
          (6 * waveMultiplier);

        const currentR = p.baseRadius + harmonic;

        // Spherical coordinates with displacement
        const x0 = currentR * Math.sin(p.phi) * Math.cos(p.theta);
        const y0 = currentR * Math.cos(p.phi);
        const z0 = currentR * Math.sin(p.phi) * Math.sin(theta_safe(p.theta));

        // 3D Rotation Y
        const x1 = x0 * cosY + z0 * sinY;
        const z1 = -x0 * sinY + z0 * cosY;

        // 3D Rotation X
        const y2 = y0 * cosX - z1 * sinX;
        const z2 = y0 * sinX + z1 * cosX;

        // Perspective camera projection (FOV perspective depth)
        const cameraDistance = 240;
        const perspective = cameraDistance / (cameraDistance + z2);

        const px = centerX + x1 * perspective;
        const py = centerY + y2 * perspective;

        // Depth-based sizing & opacity
        const depthFactor = (z2 + 90) / 180; // 0 (far) to 1 (near)
        const size = Math.max(0.8, (1.2 + depthFactor * 2.2) * perspective);
        const alpha = Math.min(1, Math.max(0.12, 0.2 + depthFactor * 0.75));

        projected.push({ px, py, pz: z2, size, alpha });
      }

      function theta_safe(th: number) {
        return th;
      }

      // Sort points back-to-front for proper depth occlusion
      projected.sort((a, b) => a.pz - b.pz);

      // Render 3D points with subtle core connectors
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];

        ctx.beginPath();
        ctx.arc(pt.px, pt.py, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pt.alpha})`;
        ctx.fill();

        // Connect nearby points in foreground for a high-tech geometric lattice
        if (pt.pz > 15 && i % 4 === 0) {
          const nextPt = projected[Math.min(projected.length - 1, i + 1)];
          if (nextPt && Math.hypot(pt.px - nextPt.px, pt.py - nextPt.py) < 24) {
            ctx.beginPath();
            ctx.moveTo(pt.px, pt.py);
            ctx.lineTo(nextPt.px, nextPt.py);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${pt.alpha * 0.35})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isSpeaking, isListening, isThinking, isCalling]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex flex-col items-center justify-center w-64 h-64 sm:w-72 sm:h-72 select-none my-2 cursor-grab active:cursor-grabbing"
    >
      {/* Outer ambient breathing aura */}
      <div
        className={`absolute inset-4 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
          isSpeaking
            ? "bg-emerald-500/40 scale-125 animate-pulse"
            : isListening
            ? "bg-cyan-500/40 scale-125 animate-pulse"
            : isThinking
            ? "bg-amber-500/35 scale-120 animate-pulse"
            : isCalling
            ? "bg-indigo-500/30 scale-115 animate-pulse"
            : "bg-emerald-500/15 scale-100"
        }`}
      />

      {/* 60FPS 3D WebGL / Particle Canvas */}
      <canvas
        ref={canvasRef}
        width={288}
        height={288}
        className="relative z-10 w-full h-full pointer-events-none"
      />

      {/* Center Core Badge with Telephony Glyphs */}
      <div
        className={`absolute z-20 w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center backdrop-blur-md shadow-2xl transition-all duration-500 border ${
          isSpeaking
            ? "bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-emerald-500/40 scale-110"
            : isListening
            ? "bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-cyan-500/40 scale-105 animate-pulse"
            : isThinking
            ? "bg-amber-950/80 border-amber-400 text-amber-300 shadow-amber-500/40 scale-105"
            : isCalling
            ? "bg-indigo-950/80 border-indigo-400 text-indigo-300 shadow-indigo-500/40"
            : "bg-black/70 border-white/20 text-emerald-400 shadow-black/80"
        }`}
      >
        {isSpeaking ? (
          <Volume2 className="w-6 h-6 animate-pulse" />
        ) : isListening ? (
          <Mic className="w-6 h-6 animate-bounce" />
        ) : isThinking ? (
          <Brain className="w-6 h-6 animate-pulse" />
        ) : isCalling ? (
          <Phone className="w-6 h-6 animate-pulse" />
        ) : (
          <Activity className="w-6 h-6 text-emerald-400" />
        )}
      </div>

      {/* Dynamic Telemetry State Capsule */}
      <div className="absolute -bottom-3 z-30 flex items-center justify-center">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-mono font-semibold tracking-wider uppercase backdrop-blur-md shadow-lg transition-all ${
            isSpeaking
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20"
              : isListening
              ? "bg-cyan-950/90 text-cyan-300 border-cyan-500/50 shadow-cyan-500/20"
              : isThinking
              ? "bg-amber-950/90 text-amber-300 border-amber-500/50 shadow-amber-500/20 animate-pulse"
              : isCalling
              ? "bg-indigo-950/90 text-indigo-300 border-indigo-500/50 shadow-indigo-500/20"
              : "bg-black/80 text-gray-300 border-white/10"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isSpeaking
                ? "bg-emerald-400 animate-ping"
                : isListening
                ? "bg-cyan-400 animate-ping"
                : isThinking
                ? "bg-amber-400 animate-ping"
                : isCalling
                ? "bg-indigo-400 animate-ping"
                : "bg-emerald-400"
            }`}
          />
          <span>
            {isSpeaking
              ? "STREAMING VOICE (8kHz μ-law)"
              : isListening
              ? "RECEIVING CALLER AUDIO"
              : isThinking
              ? "SŪTRADB VECTOR GROUNDING"
              : isCalling
              ? "CARRIER TRUNK ACTIVE"
              : "3D ACOUSTIC ORB STANDBY"}
          </span>
        </div>
      </div>
    </div>
  );
}
