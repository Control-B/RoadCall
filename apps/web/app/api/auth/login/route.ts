import { NextRequest, NextResponse } from 'next/server'

// Temporary mock authentication - replace with actual auth service
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Mock user database (replace with actual database query)
    const mockUsers = [
      { email: 'driver@roadcall.com', password: 'demo123', role: 'driver', name: 'John Driver' },
      { email: 'vendor@roadcall.com', password: 'demo123', role: 'vendor', name: 'Mike Mechanic' },
      { email: 'dispatcher@roadcall.com', password: 'demo123', role: 'dispatcher', name: 'Sarah Dispatcher' },
      { email: 'admin@roadcall.com', password: 'demo123', role: 'admin', name: 'Admin User' },
    ]

    const user = mockUsers.find(u => u.email === email && u.password === password)

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Generate mock JWT token (replace with actual JWT generation)
    const token = Buffer.from(JSON.stringify({
      userId: email,
      role: user.role,
      name: user.name,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64')

    return NextResponse.json({
      token,
      role: user.role,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
