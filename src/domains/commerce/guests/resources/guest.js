export default {
    guest_list: (guest) => {
        return {
            id: guest.id,
            session_id: guest.session_id,
            name: guest.name,
            email: guest.email,
            phone: guest.phone,
            zipcode: guest.zipcode,
            state: guest.state,
            createdAt: guest.createdAt,
            updatedAt: guest.updatedAt
        }
    }
}
