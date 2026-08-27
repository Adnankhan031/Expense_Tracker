import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard, or 0 when it is closed.
 *
 * KeyboardAvoidingView is not reliable on Android under edge-to-edge: the window
 * no longer resizes, so `behavior` has nothing to push against and the composer
 * ends up underneath the keyboard. Tracking the height ourselves and padding the
 * container is deterministic, and needs no native module - so it still ships as
 * an over-the-air update.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS fires "will" events early enough to animate with the keyboard;
    // Android only has the "did" ones.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
