/**
 * Get the real client IP address from request
 * Handles proxies, load balancers, and CDNs (Vercel, Cloudflare, etc.)
 */
function getClientIp(req) {
  // Check x-forwarded-for header (most common for proxies)
  // Format: "client-ip, proxy1-ip, proxy2-ip"
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Take the first IP (original client)
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    const realIp = ips[0];
    if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') {
      return realIp;
    }
  }

  // Check x-real-ip header (nginx, some proxies)
  const realIp = req.headers['x-real-ip'];
  if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') {
    return realIp;
  }

  // Check cf-connecting-ip (Cloudflare)
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && cfIp !== '127.0.0.1' && cfIp !== '::1') {
    return cfIp;
  }

  // Check x-client-ip (some proxies)
  const clientIp = req.headers['x-client-ip'];
  if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
    return clientIp;
  }

  // Use req.ip (works if trust proxy is enabled)
  if (req.ip && req.ip !== '127.0.0.1' && req.ip !== '::1' && req.ip !== '::ffff:127.0.0.1') {
    return req.ip;
  }

  // Fallback to connection remote address
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
  if (remoteAddress && remoteAddress !== '127.0.0.1' && remoteAddress !== '::1') {
    // Remove IPv6 prefix if present
    return remoteAddress.replace('::ffff:', '');
  }

  // Last resort fallback
  return 'unknown';
}

module.exports = getClientIp;
