import { useRef, useEffect } from 'react'

export function Starfield() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let animId
    let stars = []
    let shootingStars = []
    const STAR_COUNT = 180
    const SHOOTING_INTERVAL = 4000

    function resize() {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.scale(dpr, dpr)
      initStars()
    }

    function initStars() {
      const w = window.innerWidth
      const h = window.innerHeight
      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        alpha: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.05,
      }))
    }

    function spawnShootingStar() {
      const w = window.innerWidth
      const h = window.innerHeight
      shootingStars.push({
        x: Math.random() * w * 0.8,
        y: Math.random() * h * 0.3,
        vx: 3 + Math.random() * 4,
        vy: 1.5 + Math.random() * 2,
        life: 1,
        decay: 0.015 + Math.random() * 0.01,
        len: 30 + Math.random() * 40,
      })
    }

    let lastShoot = 0

    function draw(t) {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)

      // Stars
      for (const s of stars) {
        const twinkle = Math.sin(t * s.twinkleSpeed + s.twinkleOffset)
        const a = s.alpha + twinkle * 0.25
        if (a <= 0) continue
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 210, 255, ${Math.min(a, 0.85)})`
        ctx.fill()

        // Subtle glow on brighter stars
        if (s.r > 1) {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(180, 200, 255, ${a * 0.1})`
          ctx.fill()
        }

        s.x += s.drift
        if (s.x < 0) s.x = w
        if (s.x > w) s.x = 0
      }

      // Shooting stars
      if (t - lastShoot > SHOOTING_INTERVAL + Math.random() * 3000) {
        spawnShootingStar()
        lastShoot = t
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i]
        const tailX = ss.x - ss.vx * (ss.len / 4)
        const tailY = ss.y - ss.vy * (ss.len / 4)

        const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y)
        grad.addColorStop(0, `rgba(255, 255, 255, 0)`)
        grad.addColorStop(1, `rgba(255, 255, 255, ${ss.life * 0.8})`)

        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(ss.x, ss.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Head glow
        ctx.beginPath()
        ctx.arc(ss.x, ss.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${ss.life})`
        ctx.fill()

        ss.x += ss.vx
        ss.y += ss.vy
        ss.life -= ss.decay

        if (ss.life <= 0) shootingStars.splice(i, 1)
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    animId = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
