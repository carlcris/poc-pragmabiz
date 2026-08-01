import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";

export const useScreenFocusState = () => {
  const navigation = useNavigation();
  const [isFocused, setIsFocused] = useState(() => navigation.isFocused());

  useEffect(() => {
    setIsFocused(navigation.isFocused());
    const unsubscribeFocus = navigation.addListener("focus", () => setIsFocused(true));
    const unsubscribeBlur = navigation.addListener("blur", () => setIsFocused(false));

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

  return isFocused;
};
