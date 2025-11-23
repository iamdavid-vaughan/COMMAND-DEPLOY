'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  deploymentId: string;
  token: string;
  onConnectionStatusChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

export default function Terminal({
  deploymentId,
  token,
  onConnectionStatusChange,
  onError
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!terminalRef.current || !token) return;

    // Create terminal
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      },
      rows: 30,
      cols: 100,
      scrollback: 1000,
      allowProposedApi: true
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Add web links addon
    const webLinksAddon = new WebLinksAddon();
    terminal.loadAddon(webLinksAddon);

    // Open terminal
    terminal.open(terminalRef.current);
    xtermRef.current = terminal;

    // Store cleanup functions
    let cleanupFunctions: (() => void)[] = [];

    // Wait for terminal to be fully rendered before proceeding
    // This fixes the "Cannot read properties of undefined (reading 'dimensions')" error
    setTimeout(() => {
      // Fit terminal to container
      fitAddon.fit();

      // Welcome message
      terminal.writeln('\x1b[1;32mConnecting to SSH terminal...\x1b[0m');
      terminal.writeln('');

      // Create WebSocket connection after terminal is ready
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.focuswithfocal.io';
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/terminal?token=' + encodeURIComponent(token);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      terminal.writeln('\x1b[1;32m WebSocket connected\x1b[0m');
      terminal.writeln('Establishing SSH connection...');
      terminal.writeln('');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'ready':
            setConnected(true);
            onConnectionStatusChange?.(true);
            terminal.writeln('\x1b[1;32m SSH connection established\x1b[0m');
            terminal.writeln('');
            terminal.focus();
            break;

          case 'data':
            // Decode base64 data and write to terminal
            const data = atob(message.data);
            terminal.write(data);
            break;

          case 'error':
            terminal.writeln('\x1b[1;31m Error: ' + message.data + '\x1b[0m');
            onError?.(message.data);
            break;

          case 'close':
            terminal.writeln('');
            terminal.writeln('\x1b[1;33mSSH session ended\x1b[0m');
            setConnected(false);
            onConnectionStatusChange?.(false);
            break;

          case 'pong':
            // Keepalive response
            break;

          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      terminal.writeln('\x1b[1;31m WebSocket error\x1b[0m');
      onError?.('WebSocket connection error');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setConnected(false);
      onConnectionStatusChange?.(false);
      if (!terminal.buffer.active.length || terminal.buffer.active.getLine(terminal.buffer.active.length - 1)?.translateToString().indexOf('session ended') === -1) {
        terminal.writeln('');
        terminal.writeln('\x1b[1;33mConnection closed\x1b[0m');
      }
    };

    // Handle terminal input
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send data to server (base64 encoded)
        ws.send(JSON.stringify({
          type: 'input',
          data: btoa(data)
        }));
      }
    });

    // Handle terminal resize with debouncing
    let resizeTimeout: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (fitAddon && terminalRef.current) {
        fitAddon.fit();

        // Debounce resize events to server (300ms)
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'resize',
              rows: terminal.rows,
              cols: terminal.cols
            }));
          }
        }, 300);
      }
    };

    // Resize on window resize
    window.addEventListener('resize', handleResize);
    cleanupFunctions.push(() => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    });

    // Initial fit
    setTimeout(handleResize, 100);

    // Keepalive ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Every 30 seconds

    cleanupFunctions.push(() => clearInterval(pingInterval));
    cleanupFunctions.push(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    });
    }, 100); // Wait 100ms for terminal to be fully rendered

    // Cleanup
    return () => {
      cleanupFunctions.forEach(fn => fn());
      terminal.dispose();
    };
  }, [deploymentId, token, onConnectionStatusChange, onError]);

  return (
    <div className="w-full h-full bg-[#1e1e1e] rounded-lg overflow-hidden">
      <div ref={terminalRef} className="w-full h-full p-2" />
    </div>
  );
}
