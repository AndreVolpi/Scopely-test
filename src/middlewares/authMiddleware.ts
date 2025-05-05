import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// Middleware to verify the JWT token
const authenticate = (req: any, res: any, next: Function) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.send({ message: 'Authorization token required.' }, 401);
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.send({ message: 'Invalid or expired token.' }, 401);
    }

    // If valid, attach the decoded payload (which contains player info)
    req.user = decoded;

    next();
  });
};

export default authenticate;
