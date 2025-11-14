export default {
    user_list: (user) => {
        return {
            _id: user.id,
            name: user.name,
            surname: user.surname,
            email: user.email,
            avatar: user.avatar,
            phone: user.phone,
            birthday: user.birthday,
            zipcode: user.zipcode
        }
    }
}
