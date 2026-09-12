import type { LunaUnload } from "@luna/core";
import { StyleTag } from "@luna/lib";
import nebula from "file://assets/nebula.jpg?base64";
import styles from "file://meteor-night.css?minify";

export const unloads = new Set<LunaUnload>();

new StyleTag("MeteorNight", unloads, styles.replace("__METEOR_NIGHT_NEBULA__", `data:image/jpeg;base64,${nebula}`));

const MAX_METEORS = 28;
const METEOR_LAYER_ID = "meteor-night-layer";
const activeMeteors = new Set<HTMLDivElement>();
const animations = new Set<Animation>();
let generationTimeout: number | undefined;
let meteorLayer: HTMLDivElement | undefined;
let disposed = false;

function isCenteredOnArtwork(element: HTMLElement): boolean {

	if (!(element instanceof HTMLButtonElement) && element.getAttribute("role") !== "button") return false;
	if (element.closest("#footerPlayer, [class*='footerPlayer'], [class*='miniPlayer']")) return false;

	const control = element.getBoundingClientRect();
	if (control.width < 28 || control.width > 96 || Math.abs(control.width - control.height) > 10) return false;

	const centerX = control.left + control.width / 2;
	const centerY = control.top + control.height / 2;
	return [...document.images].some((image) => {
		const artwork = image.getBoundingClientRect();
		return artwork.width > 70 && artwork.height > 70
			&& centerX > artwork.left && centerX < artwork.right
			&& centerY > artwork.top && centerY < artwork.bottom;
	});
}

function hideArtworkPlayOverlays(): void {

	for (const control of document.querySelectorAll<HTMLElement>("button, [role='button']")) {
		if (!isCenteredOnArtwork(control)) continue;
		control.style.setProperty("display", "none", "important");
		control.dataset.meteorNightOverlayHidden = "true";
	}
}

function observeArtworkPlayOverlays(): void {

	const scan = () => window.requestAnimationFrame(hideArtworkPlayOverlays);
	const observer = new MutationObserver(scan);
	observer.observe(document.body, { childList: true, subtree: true });
	document.addEventListener("pointerover", scan, true);
	scan();

	unloads.add(() => {
		observer.disconnect();
		document.removeEventListener("pointerover", scan, true);
		for (const control of document.querySelectorAll<HTMLElement>("[data-meteor-night-overlay-hidden='true']")) {
			control.style.removeProperty("display");
			delete control.dataset.meteorNightOverlayHidden;
		}
	});
}

function isDarkRecommendationRow(element: HTMLElement): boolean {

	if (element.dataset.meteorNightRecommendationTransparent === "true") return false;
	if (element.closest("#footerPlayer, #sidebar, [class*='sidebar'], [class*='player']")) return false;

	const rect = element.getBoundingClientRect();
	if (rect.width < 180 || rect.height < 42 || rect.height > 115) return false;

	if ((element.textContent?.trim().length ?? 0) < 3) return false;

	return true;
}

function makeRecommendationsTransparent(): void {

	for (const element of document.querySelectorAll<HTMLElement>("*")) {
		if (!isDarkRecommendationRow(element)) continue;
		element.style.setProperty("background", "transparent", "important");
		element.style.setProperty("background-color", "transparent", "important");
		element.style.setProperty("background-image", "none", "important");
		element.style.setProperty("box-shadow", "none", "important");
		element.dataset.meteorNightRecommendationTransparent = "true";
	}
}

function observeRecommendationTransparency(): void {

	const scan = () => window.requestAnimationFrame(makeRecommendationsTransparent);
	const observer = new MutationObserver(scan);
	observer.observe(document.body, { childList: true, subtree: true });
	window.addEventListener("resize", scan);
	scan();

	unloads.add(() => {
		observer.disconnect();
		window.removeEventListener("resize", scan);
		for (const element of document.querySelectorAll<HTMLElement>("[data-meteor-night-recommendation-transparent='true']")) {
			element.style.removeProperty("background");
			element.style.removeProperty("background-color");
			element.style.removeProperty("background-image");
			element.style.removeProperty("box-shadow");
			delete element.dataset.meteorNightRecommendationTransparent;
		}
	});
}

function randomBetween(min: number, max: number): number {

	return min + Math.random() * (max - min);
}

function removeMeteor(meteor: HTMLDivElement, animation?: Animation): void {

	if (animation) animations.delete(animation);
	activeMeteors.delete(meteor);
	meteor.remove();
}

function createMeteor(): void {

	if (!meteorLayer || activeMeteors.size >= MAX_METEORS) return;

	const meteor = document.createElement("div");
	meteor.className = "meteor-night-star";

	const thickness = randomBetween(1, 2.5);
	const length = randomBetween(50, 110);
	const duration = randomBetween(2_800, 4_800);
	const intensity = randomBetween(0.55, 0.9);
	const startX = randomBetween(0, window.innerWidth * 1.5);
	const startY = randomBetween(-150, -50);
	const distance = window.innerWidth + window.innerHeight;

	Object.assign(meteor.style, {
		width: `${length}px`,
		height: `${thickness}px`,
		left: `${startX}px`,
		top: `${startY}px`,
	});

	meteorLayer.append(meteor);
	activeMeteors.add(meteor);

	const animation = meteor.animate([
		{ opacity: 0, transform: "rotate(-45deg) translate3d(0, 0, 0)" },
		{ opacity: intensity, offset: 0.12 },
		{ opacity: intensity * 0.7, offset: 0.7 },
		{ opacity: 0, transform: `rotate(-45deg) translate3d(-${distance}px, 0, 0)` },
	], {
		duration,
		easing: "linear",
		fill: "forwards",
	});

	animations.add(animation);
	void animation.finished.then(
		() => removeMeteor(meteor, animation),
		() => removeMeteor(meteor, animation),
	);
}

function scheduleMeteor(): void {

	if (disposed) return;
	generationTimeout = window.setTimeout(() => {
		if (disposed) return;
		createMeteor();
		scheduleMeteor();
	}, randomBetween(300, 650));
}

function cleanup(): void {

	disposed = true;
	if (generationTimeout !== undefined) window.clearTimeout(generationTimeout);
	generationTimeout = undefined;

	for (const animation of animations) animation.cancel();
	animations.clear();
	for (const meteor of activeMeteors) meteor.remove();
	activeMeteors.clear();
	meteorLayer?.remove();
	meteorLayer = undefined;
}

unloads.add(cleanup);
observeArtworkPlayOverlays();
observeRecommendationTransparency();

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
	meteorLayer = document.createElement("div");
	meteorLayer.id = METEOR_LAYER_ID;
	Object.assign(meteorLayer.style, {
		position: "fixed",
		inset: "0",
		width: "100vw",
		height: "100vh",
		pointerEvents: "none",
		overflow: "hidden",
		zIndex: "2147483647",
	});
	document.body.append(meteorLayer);
	scheduleMeteor();
}
