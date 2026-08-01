import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ApiError } from "@/api/client";
import type { PickLocationMap } from "@/api/picking";
import { usePickLocationMap } from "@/hooks/queries";
import { colors } from "@/theme/colors";

type Props = {
  visible: boolean;
  pickListId: string;
  pickListItemId: string | null;
  onClose: () => void;
};

type TouchPoint = {
  pageX: number;
  pageY: number;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const DEFAULT_ROTATION = 90;

const getPinchDistance = (touches: readonly TouchPoint[]) => {
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
};

type RackMapLabelProps = {
  rack: PickLocationMap["racks"][number];
  mapWidth: number;
  mapHeight: number;
};

const RackMapLabel = ({ rack, mapWidth, mapHeight }: RackMapLabelProps) => {
  const rackLeft = (mapWidth * rack.xBasisPoints) / 10_000;
  const rackTop = (mapHeight * rack.yBasisPoints) / 10_000;
  const rackWidth = (mapWidth * rack.widthBasisPoints) / 10_000;
  const rackHeight = (mapHeight * rack.heightBasisPoints) / 10_000;
  const isVerticalRack = rackHeight > rackWidth;
  const labelWidth = isVerticalRack ? rackHeight : rackWidth;
  const labelHeight = isVerticalRack ? rackWidth : rackHeight;
  const fontSize = Math.min(12, Math.max(6, labelHeight * 0.48));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.rackLabel,
        {
          left: rackLeft + (rackWidth - labelWidth) / 2,
          top: rackTop + (rackHeight - labelHeight) / 2,
          width: labelWidth,
          height: labelHeight,
          transform: isVerticalRack ? [{ rotate: "-90deg" }] : undefined,
        },
      ]}
    >
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.45}
        numberOfLines={1}
        style={[styles.rackLabelText, { fontSize }]}
      >
        {rack.name || rack.code}
      </Text>
    </View>
  );
};

export const PickLocationMapModal = ({ visible, pickListId, pickListItemId, onClose }: Props) => {
  const { width } = useWindowDimensions();
  const locationMap = usePickLocationMap(pickListId, pickListItemId, visible);
  const data = locationMap.data || null;
  const error = data ? null : locationMap.error;
  const loading = locationMap.isLoading && !data;
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(DEFAULT_ROTATION);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [imageLoadAttempt, setImageLoadAttempt] = useState(0);
  const zoomRef = useRef(1);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const pinchResponderRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  const highlightOpacity = useRef(new Animated.Value(1)).current;

  const setZoomLevel = useCallback((nextZoom: number) => {
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    zoomRef.current = clampedZoom;
    setZoom(clampedZoom);
  }, []);

  if (!pinchResponderRef.current) {
    pinchResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length === 2,
      onPanResponderGrant: (event) => {
        pinchStartDistanceRef.current = getPinchDistance(event.nativeEvent.touches);
        pinchStartZoomRef.current = zoomRef.current;
      },
      onPanResponderMove: (event) => {
        const currentDistance = getPinchDistance(event.nativeEvent.touches);
        if (pinchStartDistanceRef.current <= 0 || currentDistance <= 0) return;
        setZoomLevel(pinchStartZoomRef.current * (currentDistance / pinchStartDistanceRef.current));
      },
      onPanResponderRelease: () => {
        pinchStartDistanceRef.current = 0;
      },
      onPanResponderTerminate: () => {
        pinchStartDistanceRef.current = 0;
      },
    });
  }

  useEffect(() => {
    if (!visible || !pickListItemId) return;
    setZoomLevel(MIN_ZOOM);
    setRotation(DEFAULT_ROTATION);
  }, [visible, pickListItemId, setZoomLevel]);

  const imageUrl = data?.map.imageUrl || null;

  const highlightedLocationId = data?.location.id || null;

  useEffect(() => {
    if (!visible || !highlightedLocationId) {
      highlightOpacity.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(highlightOpacity, {
          toValue: 0.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(highlightOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => {
      animation.stop();
      highlightOpacity.setValue(1);
    };
  }, [highlightOpacity, highlightedLocationId, visible]);

  const baseWidth = Math.max(280, width - 32);
  const imageAspectRatio =
    data && data.map.imageWidth > 0 ? data.map.imageHeight / data.map.imageWidth : 1;
  const isQuarterTurn = rotation % 180 !== 0;
  const unrotatedWidth = isQuarterTurn ? (baseWidth * zoom) / imageAspectRatio : baseWidth * zoom;
  const unrotatedHeight = unrotatedWidth * imageAspectRatio;
  const canvasWidth = isQuarterTurn ? unrotatedHeight : unrotatedWidth;
  const canvasHeight = isQuarterTurn ? unrotatedWidth : unrotatedHeight;
  const imageReady = Boolean(imageUrl && loadedImageUrl === imageUrl);
  const imageLoadFailed = Boolean(imageUrl && failedImageUrl === imageUrl);
  const isMapNotConfigured =
    error instanceof ApiError && error.code === "WAREHOUSE_FLOOR_MAP_NOT_CONFIGURED";
  const errorMessage = error instanceof Error ? error.message : "Unable to load the warehouse map.";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Pick Location</Text>
            <Text style={styles.subtitle}>
              {data ? `${data.warehouse.name} · ${data.location.code}` : "Warehouse floor map"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close warehouse map"
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateText}>Loading warehouse map...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Ionicons
              name="map-outline"
              size={40}
              color={isMapNotConfigured ? colors.amber : colors.textSecondary}
            />
            <Text style={isMapNotConfigured ? styles.emptyStateTitle : styles.errorText}>
              {errorMessage}
            </Text>
            {!isMapNotConfigured ? (
              <Pressable style={styles.retryButton} onPress={() => void locationMap.refetch()}>
                <Text style={styles.retryText}>Try Again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : data ? (
          <>
            <View style={styles.locationCard}>
              <View style={styles.locationIcon}>
                <Ionicons name="location" size={22} color={colors.primary} />
              </View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationLabel}>GO TO RACK</Text>
                <Text style={styles.locationValue}>
                  {data.location.code}
                  {data.location.name ? ` · ${data.location.name}` : ""}
                </Text>
              </View>
              <Text style={styles.mapName}>{data.map.name}</Text>
            </View>

            <View style={styles.mapRegion} {...pinchResponderRef.current.panHandlers}>
              <ScrollView
                style={styles.verticalMapScroll}
                contentContainerStyle={styles.mapPadding}
              >
                <ScrollView horizontal bounces={false}>
                  <View
                    style={[
                      styles.mapCanvas,
                      {
                        width: canvasWidth,
                        height: canvasHeight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.mapContent,
                        {
                          left: (canvasWidth - unrotatedWidth) / 2,
                          top: (canvasHeight - unrotatedHeight) / 2,
                          width: unrotatedWidth,
                          height: unrotatedHeight,
                          transform: [{ rotate: `${rotation}deg` }],
                        },
                      ]}
                    >
                      <Image
                        key={`${data.map.imageUrl}:${imageLoadAttempt}`}
                        source={{ uri: data.map.imageUrl }}
                        resizeMode="contain"
                        style={StyleSheet.absoluteFill}
                        onLoadStart={() => {
                          setFailedImageUrl(null);
                          setLoadedImageUrl(null);
                        }}
                        onLoad={() => {
                          setFailedImageUrl(null);
                          setLoadedImageUrl(data.map.imageUrl);
                        }}
                        onError={() => {
                          setFailedImageUrl(data.map.imageUrl);
                        }}
                      />
                      <Animated.View
                        style={[
                          styles.rackHighlight,
                          {
                            left: `${data.highlight.xBasisPoints / 100}%`,
                            top: `${data.highlight.yBasisPoints / 100}%`,
                            width: `${data.highlight.widthBasisPoints / 100}%`,
                            height: `${data.highlight.heightBasisPoints / 100}%`,
                            opacity: highlightOpacity,
                          },
                        ]}
                      />
                      {data.racks.map((rack) => (
                        <RackMapLabel
                          key={rack.warehouseLocationId}
                          rack={rack}
                          mapWidth={unrotatedWidth}
                          mapHeight={unrotatedHeight}
                        />
                      ))}
                    </View>
                  </View>
                </ScrollView>
              </ScrollView>
              {!imageReady && !imageLoadFailed ? (
                <View pointerEvents="none" style={styles.mapLoadOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : null}
              {imageLoadFailed ? (
                <View style={styles.mapLoadOverlay}>
                  <Ionicons name="image-outline" size={36} color={colors.textSecondary} />
                  <Text style={styles.errorText}>Unable to load the warehouse map.</Text>
                  <Pressable
                    style={styles.retryButton}
                    onPress={() => {
                      setFailedImageUrl(null);
                      setLoadedImageUrl(null);
                      setImageLoadAttempt((attempt) => attempt + 1);
                    }}
                  >
                    <Text style={styles.retryText}>Try Again</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.zoomBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                disabled={zoom <= MIN_ZOOM}
                style={[styles.zoomButton, zoom <= MIN_ZOOM ? styles.zoomButtonDisabled : null]}
                onPress={() => setZoomLevel(zoomRef.current - 0.5)}
              >
                <Ionicons name="remove" size={22} color={colors.text} />
              </Pressable>
              <Pressable style={styles.zoomReset} onPress={() => setZoomLevel(MIN_ZOOM)}>
                <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                disabled={zoom >= MAX_ZOOM}
                style={[styles.zoomButton, zoom >= MAX_ZOOM ? styles.zoomButtonDisabled : null]}
                onPress={() => setZoomLevel(zoomRef.current + 0.5)}
              >
                <Ionicons name="add" size={22} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rotate warehouse map"
                style={styles.zoomButton}
                onPress={() => setRotation((current) => (current + 90) % 360)}
              >
                <Ionicons name="refresh" size={20} color={colors.text} />
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 44,
    backgroundColor: colors.faint,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "center",
  },
  retryButton: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "700",
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    margin: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  locationIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  locationCopy: {
    flex: 1,
  },
  locationLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  locationValue: {
    marginTop: 2,
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  mapName: {
    maxWidth: 100,
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: "right",
  },
  mapRegion: {
    flex: 1,
  },
  mapLoadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  verticalMapScroll: {
    flex: 1,
  },
  mapPadding: {
    minHeight: "100%",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  mapCanvas: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  mapContent: {
    position: "absolute",
  },
  rackHighlight: {
    position: "absolute",
    borderWidth: 4,
    borderColor: colors.dangerDark,
    borderRadius: 4,
    backgroundColor: "rgba(239, 68, 68, 0.45)",
  },
  rackLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 2,
  },
  rackLabelText: {
    maxWidth: "100%",
    borderRadius: 2,
    paddingHorizontal: 2,
    color: colors.text,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    fontWeight: "800",
    textAlign: "center",
  },
  zoomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  zoomButton: {
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  zoomButtonDisabled: {
    opacity: 0.35,
  },
  zoomReset: {
    minWidth: 70,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  zoomText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
});
