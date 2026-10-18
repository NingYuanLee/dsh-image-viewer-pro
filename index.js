/**
 * Host half of the Image Viewer Pro bundle.
 *
 * The capability is entirely a browser concern: the client installs a capture
 * phase click handler that takes over content images and renders its own
 * lightbox. The Host row exists only so the package is a Loader entry whose
 * `dsh.client` declaration the Web boot graph can scan.
 *
 * @module @local/dsh-image-viewer-pro
 */

/** Nothing to install on the Host. */
export function apply() {}
