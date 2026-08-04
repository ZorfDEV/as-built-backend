import { v4 as uuidv4 } from 'uuid';

export default function publicIdPlugin(schema) {
  schema.add({
    publicId: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    }
  });
}