import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CloudUpload, Eye, EyeOff, Mail } from 'lucide-react-native';

import { useAuth } from '../src/auth';
import { totalTxnCount } from '../src/db';
import { isSupabaseConfigured } from '../src/supabase';
import { radius, space, useTheme } from '../src/theme';
import { Button, Card, Screen, tap, tapSuccess } from '../src/ui';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const t = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const localCount = totalTxnCount();
  const weak = mode === 'signup' && password.length > 0 && password.length < 8;

  const input = {
    backgroundColor: t.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: t.ink,
    fontSize: 15,
  } as const;

  const submit = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email, password, name);
        if (needsConfirmation) {
          setNotice(`Confirm the link we sent to ${email.trim()}, then sign in.`);
          setMode('signin');
          setPassword('');
        } else {
          tapSuccess();
          router.back();
        }
      } else {
        await signIn(email, password);
        tapSuccess();
        router.back();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /invalid login/i.test(msg)
          ? 'That email and password do not match an account.'
          : /already registered/i.test(msg)
            ? 'An account already exists for that email. Try signing in.'
            : msg
      );
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <Screen>
        <View style={{ padding: space.lg }}>
          <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700' }}>Sync is not configured</Text>
          <Text style={{ color: t.dim, fontSize: 13.5, marginTop: 8, lineHeight: 20 }}>
            This build has no Supabase credentials. Everything still works on this device.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.brand,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: space.lg,
            }}
          >
            <CloudUpload size={24} color={t.onBrand} />
          </View>

          <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 }}>
            {mode === 'signin' ? 'Sign in to sync' : 'Create your account'}
          </Text>
          <Text style={{ color: t.dim, fontSize: 14, lineHeight: 21, marginTop: 8 }}>
            {mode === 'signin'
              ? 'Your expenses stay on this phone either way. Signing in keeps them backed up and in step with the web app.'
              : 'One account, both apps. Everything you log stays on the device and syncs when there is a connection.'}
          </Text>

          {localCount > 0 && (
            <Card style={{ marginTop: space.lg, backgroundColor: t.brandSoft, borderColor: 'transparent' }}>
              <Text style={{ color: t.brand, fontSize: 13, fontWeight: '700', lineHeight: 19 }}>
                The {localCount} {localCount === 1 ? 'entry' : 'entries'} already on this phone will be moved into your
                account the first time you sign in.
              </Text>
            </Card>
          )}

          <View style={{ gap: space.md, marginTop: space.xl }}>
            {mode === 'signup' && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={t.faint}
                autoCapitalize="words"
                style={input}
              />
            )}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={t.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={input}
            />
            <View style={{ justifyContent: 'center' }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'}
                placeholderTextColor={t.faint}
                secureTextEntry={!show}
                autoCapitalize="none"
                style={{ ...input, paddingRight: 44 }}
              />
              <Pressable
                onPress={() => { tap(); setShow((v) => !v); }}
                hitSlop={10}
                style={{ position: 'absolute', right: 14 }}
              >
                {show ? <EyeOff size={17} color={t.faint} /> : <Eye size={17} color={t.faint} />}
              </Pressable>
            </View>
            {weak && <Text style={{ color: t.warn, fontSize: 11.5 }}>Use at least 8 characters.</Text>}

            {!!error && (
              <View style={{ backgroundColor: t.downSoft, borderRadius: radius.md, padding: 12 }}>
                <Text style={{ color: t.down, fontSize: 13, lineHeight: 19 }}>{error}</Text>
              </View>
            )}
            {!!notice && (
              <View style={{ flexDirection: 'row', gap: 8, backgroundColor: t.upSoft, borderRadius: radius.md, padding: 12 }}>
                <Mail size={15} color={t.up} />
                <Text style={{ color: t.up, fontSize: 13, lineHeight: 19, flex: 1 }}>{notice}</Text>
              </View>
            )}

            <Button
              title={mode === 'signin' ? 'Sign in' : 'Create account'}
              onPress={submit}
              loading={busy}
              disabled={!email.trim() || !password || weak || (mode === 'signup' && !name.trim())}
            />

            <Pressable
              onPress={() => { tap(); setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null); }}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: t.dim, fontSize: 13.5 }}>
                {mode === 'signin' ? "Don't have an account? " : 'Already have one? '}
                <Text style={{ color: t.brand, fontWeight: '700' }}>
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </Text>
              </Text>
            </Pressable>
          </View>

          <Text style={{ color: t.faint, fontSize: 11.5, textAlign: 'center', marginTop: space.xl, lineHeight: 17 }}>
            You can keep using the app without an account.{'\n'}Nothing is uploaded until you sign in.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
