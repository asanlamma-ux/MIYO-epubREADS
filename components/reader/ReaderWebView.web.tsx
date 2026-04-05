import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Mimics RN WebView for `source={{ html }}`, `onMessage`, and `injectJavaScript`
 * using an iframe + postMessage so Metro web bundles without native WebView code.
 */
const BRIDGE_SCRIPT = `<script>(function(){window.ReactNativeWebView={postMessage:function(m){try{window.parent.postMessage(typeof m==='string'?m:String(m),'*');}catch(e){}}};})();</script>`;

type WebLikeProps = {
  source?: { html?: string; uri?: string };
  style?: StyleProp<ViewStyle>;
  onMessage?: (e: { nativeEvent: { data: string } }) => void;
  onError?: (e: { nativeEvent: { description?: string } }) => void;
  onLoadEnd?: () => void;
  scrollEnabled?: boolean;
};

const ReaderWebView = forwardRef<{ injectJavaScript: (script: string) => void }, WebLikeProps>(
  function ReaderWebView(
    {
      source,
      style,
      onMessage,
      onError,
      onLoadEnd,
      scrollEnabled = true,
    }: WebLikeProps,
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    const srcDoc = useMemo(() => {
      if (source && typeof source === 'object' && 'html' in source && source.html) {
        return BRIDGE_SCRIPT + source.html;
      }
      return null;
    }, [source]);

    useImperativeHandle(
      ref,
      () => ({
        injectJavaScript(script: string) {
          try {
            const w = iframeRef.current?.contentWindow;
            if (w) {
              (w as Window & { eval: (s: string) => void }).eval(script);
            }
          } catch (e) {
            onError?.({ nativeEvent: { description: String(e) } });
          }
        },
      }),
      [onError]
    );

    useEffect(() => {
      if (!onMessage || typeof window === 'undefined') return;
      const handler = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        const { data } = event;
        if (data == null || data === '') return;
        onMessage({ nativeEvent: { data: typeof data === 'string' ? data : String(data) } });
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, [onMessage]);

    const flat = StyleSheet.flatten(style) as Record<string, unknown>;

    if (!mounted || !srcDoc) {
      return <View style={[{ flex: 1 }, flat]} />;
    }

    return (
      <View style={[{ flex: 1, overflow: 'hidden' as const }, flat]}>
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          title="Miyo reader"
          onLoad={() => onLoadEnd?.()}
          style={{
            border: 'none',
            width: '100%',
            height: '100%',
            display: 'block',
            overflow: scrollEnabled ? 'auto' : 'hidden',
            backgroundColor: (flat?.backgroundColor as string) || 'transparent',
          }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </View>
    );
  }
);

export default ReaderWebView;
